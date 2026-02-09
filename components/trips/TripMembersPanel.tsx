"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

type Member = {
  user_id: string;
  role: "owner" | "editor" | "viewer";
  profiles?: {
    name?: string | null;
    email?: string | null;
  } | null;
};

type Props = {
  tripId: string;
  members: Member[];
  canManage: boolean;
};

export default function TripMembersPanel({ tripId, members, canManage }: Props) {
  const [items, setItems] = useState(members);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(members);
  }, [members]);

  const updateRole = async (userId: string, role: "editor" | "viewer") => {
    if (!canManage) return;
    setPendingId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update role");
      }
      setItems((prev) =>
        prev.map((member) =>
          member.user_id === userId ? { ...member, role } : member
        )
      );
    } catch (err: any) {
      setError(err.message || "Role update failed");
    } finally {
      setPendingId(null);
    }
  };

  const removeMember = async (userId: string) => {
    if (!canManage) return;
    const confirmRemove = window.confirm("Remove this member?");
    if (!confirmRemove) return;
    setPendingId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove member");
      }
      setItems((prev) => prev.filter((member) => member.user_id !== userId));
    } catch (err: any) {
      setError(err.message || "Remove failed");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-2 mt-3">
      {items.length === 0 && (
        <p className="text-xs text-gray-500">No collaborators yet.</p>
      )}
      {items.map((member) => (
        <div
          key={member.user_id}
          className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-sm"
        >
          <span className="text-gray-300 truncate">
            {member.profiles?.name ||
              member.profiles?.email ||
              `${member.user_id.slice(0, 6)}…`}
          </span>
          {canManage ? (
            <div className="flex items-center gap-2">
              <select
                value={member.role === "editor" ? "editor" : "viewer"}
                disabled={pendingId === member.user_id}
                onChange={(event) =>
                  updateRole(member.user_id, event.target.value as "editor" | "viewer")
                }
                className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-gray-200"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <button
                type="button"
                onClick={() => removeMember(member.user_id)}
                disabled={pendingId === member.user_id}
                className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-gray-300 hover:border-red-400/40 hover:text-red-200 disabled:opacity-60"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs">
              {member.role}
            </span>
          )}
        </div>
      ))}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
