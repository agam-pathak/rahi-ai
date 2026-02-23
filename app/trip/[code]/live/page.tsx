import { getMyTripRole } from "@/lib/trips/members";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import RahiBackground from "@/components/RahiBackground";
import ThemeToggle from "@/components/ThemeToggle";
import TripLiveMode from "@/components/trips/TripLiveMode";
import { Compass } from "lucide-react";

type PageProps = {
  params: Promise<{ code: string }>;
};

type LiveActivity = {
  id?: string | null;
  title?: string | null;
  location?: {
    name?: string | null;
  } | null;
  estimated_cost?: number | null;
  duration_minutes?: number | null;
  order_index?: number | null;
  type?: string | null;
};

type LiveDay = {
  day_number: number;
  summary?: string | null;
  activities?: LiveActivity[] | null;
};

const normalizeLiveDays = (raw: unknown): LiveDay[] => {
  if (!Array.isArray(raw)) return [];
  const collected = raw.reduce<LiveDay[]>((acc, day) => {
    if (!day || typeof day !== "object") return acc;
    const asDay = day as {
      day_number?: unknown;
      summary?: unknown;
      activities?: unknown;
    };
    const dayNumber = Number(asDay.day_number);
    if (!Number.isFinite(dayNumber)) return acc;
    const activities = Array.isArray(asDay.activities)
      ? (asDay.activities as LiveActivity[])
      : [];
    acc.push({
      day_number: dayNumber,
      summary: typeof asDay.summary === "string" ? asDay.summary : undefined,
      activities,
    });
    return acc;
  }, []);
  return collected.sort((a, b) => a.day_number - b.day_number);
};

export default async function TripLivePage({ params }: PageProps) {
  const { code } = await params;
  const shareCode = String(code || "").toUpperCase();
  const supabase = await createClient();

  const { data: publicTrip } = await supabase
    .from("trips")
    .select("id, destination, days, budget, result, share_code, is_public")
    .eq("share_code", shareCode)
    .single();

  const { data: adminTrip } =
    !publicTrip && supabaseAdmin
      ? await supabaseAdmin
          .from("trips")
          .select("id, destination, days, budget, result, share_code, is_public")
          .eq("share_code", shareCode)
          .single()
      : { data: null };

  const trip = publicTrip ?? adminTrip;

  if (!trip) {
    return (
      <div className="min-h-screen bg-rahi-bg px-4 sm:px-6 text-white flex items-center justify-center">
        <div className="rahi-panel px-8 py-6 text-center">
          Trip not found ❌
        </div>
      </div>
    );
  }

  const myRole = await getMyTripRole(trip.id);

  if (trip.is_public === false && !myRole) {
    return (
      <div className="relative min-h-screen px-4 sm:px-6 py-8 sm:py-10 text-white">
        <RahiBackground />
        <div className="relative z-10 mx-auto max-w-2xl rahi-panel px-8 py-10 text-center">
          <h1 className="text-2xl font-display font-bold text-white">Private Trip</h1>
          <p className="mt-2 text-sm text-gray-400">
            This live trip mode is private. Sign in with the invited account or ask the owner for access.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <a href="/login" className="rahi-btn-primary px-4 py-2 text-sm">
              Sign in
            </a>
            <a href="/" className="rahi-btn-secondary px-4 py-2 text-sm">
              Back home
            </a>
          </div>
        </div>
      </div>
    );
  }

  let itinerary: any = trip.result;
  if (typeof trip.result === "string") {
    try {
      itinerary = JSON.parse(trip.result);
    } catch {
      itinerary = null;
    }
  }

  const liveDays = normalizeLiveDays(itinerary?.days);
  const destination = itinerary?.destination || trip.destination || "Your Trip";

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 py-8 text-white sm:px-6 sm:py-10">
      <RahiBackground />
      <div className="relative z-10 mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="rahi-logo flex items-center gap-2 text-lg font-display font-bold text-white">
            <img
              src="/brand/rahi-mark.svg"
              alt="Rahi.AI"
              className="h-8 w-8 rounded-lg border border-white/10 shadow-[0_0_16px_rgba(20,184,166,0.3)]"
            />
            Rahi.AI Live
          </div>
          <div className="flex items-center gap-2">
            <a href={`/trip/${shareCode}`} className="rahi-btn-secondary px-3 py-2 text-xs">
              Trip Overview
            </a>
            <a href="/" className="rahi-btn-secondary px-3 py-2 text-xs">
              Home
            </a>
            <ThemeToggle />
          </div>
        </div>

        <section className="rahi-panel p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-teal-200">
                On-the-go control
              </p>
              <h1 className="mt-1 text-2xl font-display font-bold text-white sm:text-3xl">
                {destination}
              </h1>
              <p className="mt-2 text-sm text-gray-400">
                Day Mode keeps your itinerary actionable on mobile with quick live changes.
              </p>
            </div>
            <a href={`/planner?mode=chat&trip=${trip.id}`} className="rahi-btn-primary px-3 py-2 text-xs">
              <Compass className="h-4 w-4" />
              Ask Travel Buddy
            </a>
          </div>
        </section>

        {liveDays.length > 0 ? (
          <TripLiveMode tripId={trip.id} destination={destination} days={liveDays} />
        ) : (
          <section className="rahi-panel p-6 text-center">
            <p className="text-sm text-gray-300">
              No itinerary data found for live mode yet.
            </p>
            <a href={`/trip/${shareCode}`} className="mt-4 inline-flex rahi-btn-secondary px-4 py-2 text-sm">
              Open itinerary
            </a>
          </section>
        )}
      </div>
    </main>
  );
}
