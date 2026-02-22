"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Compass, Copy, ExternalLink } from "lucide-react";
import RahiBackground from "@/components/RahiBackground";

type TripRow = {
  id: string;
  destination?: string | null;
  days?: number | string | null;
  budget?: number | string | null;
  share_code?: string | null;
  is_public?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export default function MyTripsPage() {
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const loadTrips = async () => {
      try {
        const res = await fetch("/api/trips");
        if (!res.ok) {
          setError(res.status === 401 ? "Please sign in to view your trips." : "Failed to load trips.");
          setTrips([]);
          return;
        }
        const data = await res.json();
        setTrips(Array.isArray(data) ? (data as TripRow[]) : []);
        setError(null);
      } catch {
        setError("Failed to load trips.");
        setTrips([]);
      } finally {
        setLoading(false);
      }
    };
    loadTrips();
  }, []);

  const parseAmount = (value: number | string | null | undefined) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatAmount = (value: number | string | null | undefined) =>
    parseAmount(value).toLocaleString("en-IN");

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <RahiBackground />
      <div className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="rahi-logo flex items-center gap-2 text-lg font-display font-bold text-white">
            <img
              src="/brand/rahi-mark.svg"
              alt="Rahi.AI"
              className="h-8 w-8 rounded-lg border border-white/10 shadow-[0_0_16px_rgba(20,184,166,0.3)]"
            />
            My Trips
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="rahi-btn-secondary px-3 py-2 text-xs">
              Home
            </Link>
            <Link href="/planner" className="rahi-btn-primary px-3 py-2 text-xs">
              New Trip
            </Link>
          </div>
        </div>

        <div className="rahi-panel p-4 sm:p-6">
          <h1 className="text-2xl font-display font-bold text-white sm:text-3xl">
            Your saved journeys
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Manage past itineraries, reopen trip links, and share from one place.
          </p>
        </div>

        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`trip-skeleton-${index}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse"
              >
                <div className="h-5 w-2/3 rounded bg-white/10" />
                <div className="mt-3 h-4 w-1/2 rounded bg-white/10" />
                <div className="mt-6 h-9 w-full rounded bg-white/10" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rahi-panel p-4 text-sm text-red-300">{error}</div>
        )}

        {!loading && !error && trips.length === 0 && (
          <div className="rahi-panel p-6 text-center">
            <Compass className="mx-auto h-8 w-8 text-teal-300" />
            <p className="mt-3 text-sm text-gray-300">No trips yet.</p>
            <Link href="/planner" className="mt-4 inline-flex rahi-btn-primary px-4 py-2 text-sm">
              Build your first itinerary
            </Link>
          </div>
        )}

        {!loading && !error && trips.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <article
                key={trip.id}
                className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-[0_18px_40px_-30px_rgba(34,211,238,0.45)]"
              >
                <h2 className="text-lg font-semibold text-teal-200">
                  {trip.destination || "Untitled Trip"}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
                    <CalendarDays className="h-3 w-3" />
                    {trip.days || "—"} days
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                    ₹{formatAmount(trip.budget)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 ${
                      trip.is_public === false
                        ? "border border-amber-400/30 bg-amber-500/10 text-amber-200"
                        : "border border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                    }`}
                  >
                    {trip.is_public === false ? "Private" : "Public"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Link
                    href={trip.share_code ? `/trip/${trip.share_code}` : "/planner"}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-300/35 bg-teal-500/15 px-3 py-2 text-sm font-semibold text-teal-100 hover:bg-teal-500/20"
                  >
                    View
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={async () => {
                      if (!trip.share_code) return;
                      await navigator.clipboard.writeText(
                        `${window.location.origin}/trip/${trip.share_code}`
                      );
                      setCopiedId(trip.id);
                      window.setTimeout(() => setCopiedId((prev) => (prev === trip.id ? null : prev)), 1800);
                    }}
                    disabled={!trip.share_code}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-gray-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copiedId === trip.id ? "Copied" : "Copy Link"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
