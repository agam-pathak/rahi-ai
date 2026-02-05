import { getTripWithMembers, getMyTripRole } from "@/lib/trips/members";
import { createClient } from "@/lib/supabase/server";
import AddMemberButton from "@/components/trips/AddMemberButton";
import TripMembersPanel from "@/components/trips/TripMembersPanel";
import TripItinerary from "@/components/trips/TripItinerary";
import RahiBackground from "@/components/RahiBackground";
import ThemeToggle from "@/components/ThemeToggle";
import TripMap from "@/components/maps/TripMap";
import { MapPin } from "lucide-react";

type PageProps = {
  params: Promise<{ code: string }>;
};

export default async function TripView({ params }: PageProps) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: trip, error } = await supabase
    .from("trips")
    .select("id, destination, days, budget, interests, result, share_code, is_public, user_id")
    .eq("share_code", code)
    .single();

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-rahi-bg text-white flex items-center justify-center px-4 sm:px-6">
        <div className="rahi-panel px-8 py-6 text-center">
          Trip not found ❌
        </div>
      </div>
    );
  }

  const myRole = await getMyTripRole(trip.id);

  if (trip.is_public === false && !myRole) {
    return (
      <div className="relative min-h-screen text-white px-4 sm:px-6 py-8 sm:py-10">
        <RahiBackground />
        <div className="relative z-10 max-w-2xl mx-auto text-center rahi-panel px-8 py-10">
          <h1 className="text-2xl font-display font-bold text-white">Private Trip</h1>
          <p className="text-sm text-gray-400 mt-2">
            This itinerary is private. Sign in with the invited account or ask the owner for access.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <a href="/login" className="rahi-btn-primary text-sm px-4 py-2">
              Sign in
            </a>
            <a href="/" className="rahi-btn-secondary text-sm px-4 py-2">
              Back home
            </a>
          </div>
        </div>
      </div>
    );
  }

  const tripWithMembers = myRole ? await getTripWithMembers(trip.id) : null;

  let itinerary: any = trip.result;
  if (typeof trip.result === "string") {
    try {
      itinerary = JSON.parse(trip.result);
    } catch {
      itinerary = null;
    }
  }

  const mapStops = Array.isArray(itinerary?.days)
    ? itinerary.days.flatMap((day: any) =>
        (day.activities || []).map((activity: any, index: number) => {
          const coord =
            activity.location?.coordinates ||
            (activity.location?.lng !== undefined && activity.location?.lat !== undefined
              ? [activity.location.lng, activity.location.lat]
              : undefined);
          return {
            id: activity.id || `${day.day_number}-${index}`,
            name: activity.location?.name || activity.title,
            day: day.day_number,
            sequence: activity.order_index ?? index,
            cost: Number(activity.estimated_cost) || undefined,
            duration: activity.duration_minutes || undefined,
            coordinates: coord as [number, number] | undefined,
          };
        })
      )
    : [];

  const tripMembers = tripWithMembers?.trip_members ?? [];

  return (
    <div className="relative min-h-screen text-white px-4 sm:px-6 py-8 sm:py-10">
      <RahiBackground />
      <div className="relative z-10 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="rahi-logo flex items-center gap-2 text-lg font-display font-bold text-white">
            <img
              src="/brand/rahi-mark.svg"
              alt="Rahi.AI"
              className="h-8 w-8 rounded-lg border border-white/10 shadow-[0_0_16px_rgba(20,184,166,0.3)]"
            />
            Rahi.AI
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="rahi-btn-secondary text-xs px-3 py-2">
              Home
            </a>
            <ThemeToggle />
          </div>
        </div>
        {/* Trip Header */}
        <div className="rahi-panel p-4 sm:p-6">
          <h1 className="text-3xl font-display font-bold text-white">
            {trip.destination}
          </h1>
          <p className="text-sm text-rahi-muted mt-1">
            {trip.days} days • ₹{trip.budget}
          </p>
        </div>

        <div className="rahi-panel p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-teal-400 font-bold text-sm uppercase tracking-wide">
              <MapPin className="w-4 h-4" /> Trip Map
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                itinerary?.destination || trip.destination
              )}`}
              target="_blank"
              rel="noreferrer"
              className="rahi-btn-ghost text-[10px]"
            >
              Open Map
            </a>
          </div>
          <TripMap
            destination={itinerary?.destination || trip.destination}
            stops={mapStops}
            mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""}
            premium={myRole === "owner" || myRole === "editor"}
          />
          {mapStops.length === 0 && (
            <p className="text-xs text-gray-400 mt-3">
              Add locations or regenerate for map pins.
            </p>
          )}
        </div>

        {/* Itinerary */}
        <div className="rahi-panel p-4 sm:p-6">
          {itinerary?.days && Array.isArray(itinerary.days) ? (
            <TripItinerary trip={itinerary} />
          ) : (
            <pre className="bg-slate-900 p-4 rounded-xl whitespace-pre-wrap">
              {typeof trip.result === "string"
                ? trip.result
                : JSON.stringify(trip.result, null, 2)}
            </pre>
          )}
        </div>

        {/* Members Section */}
        <div className="rahi-panel p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300">
              Trip Members
            </h3>
          </div>
          {myRole ? (
            <>
              {myRole === "owner" && (
                <AddMemberButton tripId={trip.id} />
              )}
              <TripMembersPanel
                tripId={trip.id}
                members={tripMembers}
                canManage={myRole === "owner"}
              />
            </>
          ) : (
            <p className="text-xs text-gray-500">
              Sign in to view collaborators.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
