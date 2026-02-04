"use client";

import { useState } from "react";

type Props = {
  tripId: string;
  onClose: () => void;
};

export default function AddMemberModal({ tripId, onClose }: Props) {
  const [userId, setUserId] = useState("");
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
        body: JSON.stringify({ userId: resolvedUserId }),
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="w-full max-w-sm rounded-xl bg-zinc-900 p-5">
        <h3 className="text-sm font-semibold mb-3">Add Trip Member</h3>

        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Email or User ID"
          className="w-full rounded bg-zinc-800 px-3 py-2 text-sm outline-none"
        />

        {error && (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm text-gray-400 hover:text-white"
          >
            Cancel
          </button>

          <button
            onClick={handleAdd}
            disabled={loading}
            className="px-4 py-1 rounded bg-teal-500 text-black text-sm font-semibold disabled:opacity-60"
          >
            {loading ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
