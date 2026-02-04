import { getTripWithMembers, getMyTripRole } from "@/lib/trips/members";
import AddMemberButton from "@/components/trips/AddMemberButton";
import TripItinerary from "@/components/trips/TripItinerary";
import RahiBackground from "@/components/RahiBackground";
import ThemeToggle from "@/components/ThemeToggle";
import TripMap from "@/components/maps/TripMap";
import { MapPin } from "lucide-react";
import { headers } from "next/headers";

type PageProps = {
  params: Promise<{ code: string }>;
};

export default async function TripView({ params }: PageProps) {
  const { code } = await params;
  const headerList = headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (host ? `${proto}://${host}` : "http://localhost:3000");

  // 1️⃣ Fetch public trip via share_code
  const res = await fetch(
    `${baseUrl}/api/trips/${code}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return (
      <div className="min-h-screen bg-rahi-bg text-white flex items-center justify-center px-6">
        <div className="rahi-panel px-8 py-6 text-center">
          Trip not found ❌
        </div>
      </div>
    );
  }

  const trip = await res.json();

  // 2️⃣ Fetch protected data using trip.id
  const tripWithMembers = await getTripWithMembers(trip.id);
  const myRole = await getMyTripRole(trip.id);

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

  return (
    <div className="relative min-h-screen text-white px-6 py-10">
      <RahiBackground />
      <div className="relative z-10 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
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
        <div className="rahi-panel p-6">
          <h1 className="text-3xl font-display font-bold text-white">
            {trip.destination}
          </h1>
          <p className="text-sm text-rahi-muted mt-1">
            {trip.days} days • ₹{trip.budget}
          </p>
        </div>

        <div className="rahi-panel p-6">
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
          />
          {mapStops.length === 0 && (
            <p className="text-xs text-gray-400 mt-3">
              Add locations or regenerate for map pins.
            </p>
          )}
        </div>

        {/* Itinerary */}
        <div className="rahi-panel p-6">
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
        <div className="rahi-panel p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300">
              Trip Members
            </h3>
          </div>
          {myRole === "owner" && (
            <AddMemberButton tripId={trip.id} />
          )}

          <div className="space-y-2 mt-3">
            {tripWithMembers.trip_members.map((member: any) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-gray-300">
                  {member.profiles?.name ||
                    member.profiles?.email ||
                    `${member.user_id.slice(0, 6)}…`}
                </span>

                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs">
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
