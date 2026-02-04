"use client";

import { useEffect, useState } from "react";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch("/api/ai/profile");
        if (!res.ok) {
          setError(res.status === 401 ? "Please sign in to view your profile." : "Failed to load profile.");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setProfile(data || {});
        setError(null);
      } catch {
        setError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const saveProfile = async () => {
    const res = await fetch("/api/ai/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    if (!res.ok) {
      setError("Failed to save profile.");
      return;
    }
    const data = await res.json();
    setProfile(data || {});
    setError(null);
  };

  if (loading) return <p className="p-6">Loading profile...</p>;
  if (error) return <p className="p-6 text-red-300">{error}</p>;

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Your Rahi Profile</h1>

      <input
        placeholder="Your Name"
        className="input"
        value={profile.name || ""}
        onChange={e => setProfile({ ...profile, name: e.target.value })}
      />

      <input
        placeholder="Travel Style (Backpacker, Luxury, Student)"
        className="input"
        value={profile.travel_style || ""}
        onChange={e => setProfile({ ...profile, travel_style: e.target.value })}
      />

      <input
        placeholder="Budget Range"
        className="input"
        value={profile.budget_range || ""}
        onChange={e => setProfile({ ...profile, budget_range: e.target.value })}
      />

      <textarea
        placeholder="Short bio"
        className="input"
        value={profile.bio || ""}
        onChange={e => setProfile({ ...profile, bio: e.target.value })}
      />

      <button
        onClick={saveProfile}
        className="bg-black text-white px-4 py-2 rounded"
      >
        Save Profile
      </button>
    </div>
  );
}
