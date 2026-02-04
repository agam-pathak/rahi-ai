"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function MyTripsPage() {
  const [trips, setTrips] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        setTrips(Array.isArray(data) ? data : []);
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

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl text-teal-400 font-bold mb-6">My Trips</h1>

      {loading && (
        <p className="text-gray-400">Loading trips...</p>
      )}

      {!loading && error && (
        <p className="text-red-300">{error}</p>
      )}

      {!loading && !error && trips.length === 0 && (
        <p className="text-gray-500">No trips yet.</p>
      )}

      {!loading && !error && (
        <div className="grid md:grid-cols-2 gap-4">
          {trips.map(trip => (
          <div key={trip.id} className="bg-slate-900 p-4 rounded-xl">
            <h2 className="text-lg font-semibold text-teal-300">
              {trip.destination}
            </h2>
            <p className="text-sm text-gray-400">
              {trip.days} days • ₹{trip.budget}
            </p>

            <div className="flex gap-3 mt-3">
              <Link
                href={`/trip/${trip.share_code}`}
                className="text-sm text-teal-400"
              >
                View
              </Link>
              <button
                onClick={() => {
                  if (!trip.share_code) return;
                  navigator.clipboard.writeText(
                    `${window.location.origin}/trip/${trip.share_code}`
                  );
                }}
                className="text-sm text-gray-400"
              >
                Copy Link
              </button>
            </div>
          </div>
          ))}
        </div>
      )}
    </main>
  );
}
