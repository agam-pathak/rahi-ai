"use client";

import { useState } from "react";

type Props = {
  tripId: string;
  onClose: () => void;
};

export default function AddMemberModal({ tripId, onClose }: Props) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

 async function handleAdd() {
  const raw = userId.trim();
  if (!raw) return;

  try {
    setLoading(true);
    setError(null);

    let resolvedUserId = raw;
    if (raw.includes("@")) {
      const lookupRes = await fetch("/api/users/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: raw }),
      });
      if (!lookupRes.ok) {
        const data = await lookupRes.json();
        throw new Error(data.error || "User not found");
      }
      const data = await lookupRes.json();
      resolvedUserId = data.id;
    }

    const res = await fetch(
      `/api/trips/${tripId}/members`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resolvedUserId, role }),
      }
    );

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to add member");
    }

    onClose();
    window.location.reload();
  } catch (err: any) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4 pt-10 sm:items-center sm:pb-0">
      <div className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-xl bg-zinc-900 p-4 sm:p-5">
        <h3 className="text-sm font-semibold mb-3">Add Trip Member</h3>

        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Email or User ID"
          className="w-full rounded bg-zinc-800 px-3 py-2 text-sm outline-none"
        />
        <p className="mt-2 text-[11px] text-gray-400">
          Enter an email or the user ID from their Profile page. The user must have signed in
          at least once.
        </p>

        <div className="mt-3">
          <label className="text-[11px] uppercase tracking-wide text-gray-400">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "viewer" | "editor")}
            className="mt-1 w-full rounded bg-zinc-800 px-3 py-2 text-sm outline-none"
          >
            <option value="viewer">Viewer (read only)</option>
            <option value="editor">Editor (can edit itinerary)</option>
          </select>
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        )}

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="w-full px-3 py-2 text-sm text-gray-400 hover:text-white sm:w-auto sm:py-1"
          >
            Cancel
          </button>

          <button
            onClick={handleAdd}
            disabled={loading}
            className="w-full rounded bg-teal-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60 sm:w-auto sm:py-1"
          >
            {loading ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
