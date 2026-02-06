import { getTripWithMembers, getMyTripRole } from "@/lib/trips/members";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import AddMemberButton from "@/components/trips/AddMemberButton";
import TripMembersPanel from "@/components/trips/TripMembersPanel";
import TripItinerary from "@/components/trips/TripItinerary";
import RahiBackground from "@/components/RahiBackground";
import ThemeToggle from "@/components/ThemeToggle";
import TripMap from "@/components/maps/TripMap";
import { ClipboardCheck, MapPin, PenLine, Sparkles } from "lucide-react";

const PREMIUM_CHECKLIST = [
  { id: "docs", label: "Government ID + booking copies" },
  { id: "insurance", label: "Travel insurance / emergency cover" },
  { id: "payments", label: "Primary + backup payment method" },
  { id: "offline", label: "Offline maps + tickets downloaded" },
  { id: "medical", label: "Basic meds + essentials packed" },
  { id: "connect", label: "Local SIM / roaming ready" },
];
const ACTIVITY_TYPE_COUNT = 5;

const getActivityCoord = (activity: any): [number, number] | null => {
  const coord = activity?.location?.coordinates;
  if (Array.isArray(coord) && coord.length === 2) {
    return coord as [number, number];
  }
  const lat = Number(activity?.location?.lat ?? NaN);
  const lng = Number(activity?.location?.lng ?? NaN);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    return [lng, lat];
  }
  return null;
};

const haversineKm = (from: [number, number], to: [number, number]) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
};

const buildAutoStory = (trip: any, dayCount: number) => {
  if (!trip?.destination || !dayCount) return "";
  const vibe = (trip?.meta?.primary_vibes?.[0] || "").replace(/_/g, " ");
  const vibeText = vibe ? `${vibe} ` : "";
  const highlights = Array.isArray(trip?.days)
    ? trip.days
        .flatMap((day: any) => (day.activities || []).map((activity: any) => activity.title))
        .filter(Boolean)
        .slice(0, 3)
    : [];
  const highlightText = highlights.length
    ? `Highlights include ${highlights.join(", ")}.`
    : "";
  const paceText = trip?.meta?.pace ? `Pace set to ${trip.meta.pace}.` : "";
  return `Rahi.AI crafted a ${dayCount}-day ${vibeText}escape to ${
    trip.destination
  }. ${highlightText} ${paceText}`
    .replace(/\s+/g, " ")
    .trim();
};

type PageProps = {
  params: Promise<{ code: string }>;
};

export default async function TripView({ params }: PageProps) {
  const { code } = await params;
  const shareCode = String(code || "").toUpperCase();
  const supabase = await createClient();
  const { data: publicTrip } = await supabase
    .from("trips")
    .select("id, destination, days, budget, interests, result, share_code, is_public, user_id")
    .eq("share_code", shareCode)
    .single();

  const { data: adminTrip } = !publicTrip && supabaseAdmin
    ? await supabaseAdmin
        .from("trips")
        .select("id, destination, days, budget, interests, result, share_code, is_public, user_id")
        .eq("share_code", shareCode)
        .single()
    : { data: null };
  const trip = publicTrip ?? adminTrip;

  if (!trip) {
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

  const itineraryDays = Array.isArray(itinerary?.days) ? itinerary.days : [];
  const activityTypes = new Set<string>();
  const dayStats: { day: number; count: number; duration: number; distance: number }[] = itineraryDays.map((day: any) => {
    let distance = 0;
    let lastCoord: [number, number] | null = null;
    const duration = (day.activities || []).reduce(
      (sum: number, activity: any) => sum + (activity.duration_minutes || 0),
      0
    );
    (day.activities || []).forEach((activity: any) => {
      if (activity.type) activityTypes.add(activity.type);
      const coord = getActivityCoord(activity);
      if (coord && lastCoord) {
        distance += haversineKm(lastCoord, coord);
      }
      if (coord) lastCoord = coord;
    });
    return {
      day: day.day_number,
      count: (day.activities || []).length,
      duration,
      distance,
    };
  });
  const totalDuration = dayStats.reduce((sum, stat) => sum + stat.duration, 0);
  const avgDuration = itineraryDays.length ? Math.round(totalDuration / itineraryDays.length) : 0;
  const totalDistanceKm = Math.round(dayStats.reduce((sum, stat) => sum + stat.distance, 0));
  const varietyScore = ACTIVITY_TYPE_COUNT
    ? Math.round((activityTypes.size / ACTIVITY_TYPE_COUNT) * 100)
    : 0;
  const busiestDay = dayStats.length
    ? dayStats.reduce((max, stat) =>
        max.duration > stat.duration ? max : stat
      )
    : null;
  const signatureStory =
    itinerary?.meta?.signature_story || buildAutoStory(itinerary, itineraryDays.length);
  const checklistState = itinerary?.meta?.prep_checklist ?? {};

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

        <div className="rahi-panel p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-teal-400 font-bold text-sm uppercase tracking-wide">
              <Sparkles className="w-4 h-4" /> Signature Plans
            </div>
            <span className="text-[10px] text-gray-400 uppercase tracking-[0.18em]">
              Premium
            </span>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-black/20 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-[11px] uppercase text-teal-200 font-semibold">
                <Sparkles className="w-3 h-3" /> Plan 1 • Precision
              </div>
              <div className="mt-3 space-y-1 text-xs text-gray-300">
                <div>Variety: {varietyScore}%</div>
                <div>
                  Avg duration: {avgDuration ? (avgDuration / 60).toFixed(1) : "0.0"}h/day
                </div>
                <div>Distance: {totalDistanceKm} km</div>
                <div>Busiest: {busiestDay ? `Day ${busiestDay.day}` : "—"}</div>
              </div>
            </div>
            <div className="bg-black/20 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-[11px] uppercase text-teal-200 font-semibold">
                <ClipboardCheck className="w-3 h-3" /> Plan 2 • Concierge
              </div>
              <div className="mt-3 space-y-1 text-xs text-gray-300">
                {PREMIUM_CHECKLIST.map((item) => {
                  const done = Boolean(checklistState[item.id]);
                  return (
                    <div
                      key={item.id}
                      className={done ? "line-through text-gray-500" : ""}
                    >
                      {done ? "✓" : "•"} {item.label}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-black/20 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-[11px] uppercase text-teal-200 font-semibold">
                <PenLine className="w-3 h-3" /> Plan 3 • Story
              </div>
              <p className="mt-3 text-xs text-gray-300 leading-relaxed">
                {signatureStory || "Generate a trip to unlock a story."}
              </p>
            </div>
          </div>
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
