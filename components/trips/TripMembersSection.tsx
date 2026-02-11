"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AddMemberButton from "./AddMemberButton";
import TripMembersPanel from "./TripMembersPanel";
import TripInvitesPanel from "./TripInvitesPanel";

type Member = {
  user_id: string;
  role: "owner" | "editor" | "viewer";
  created_at?: string;
  profiles?: {
    name?: string | null;
    email?: string | null;
  } | null;
};

type Role = "owner" | "editor" | "viewer" | null;

type Props = {
  tripId: string;
  initialMembers?: Member[];
  initialRole?: Role;
};

export default function TripMembersSection({
  tripId,
  initialMembers = [],
  initialRole = null,
}: Props) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [role, setRole] = useState<Role>(initialRole);
  const [loading, setLoading] = useState(!initialRole);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadMembers = async () => {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!active) return;
        setCurrentUserId(null);
        setCurrentUserEmail(null);
        setRole(null);
        setMembers([]);
        setNeedsLogin(true);
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);
      setCurrentUserEmail(user.email ?? null);
      setNeedsLogin(false);

      try {
        const res = await fetch(`/api/trips/${tripId}/members`);
        if (!res.ok) {
          if (res.status === 401) {
            setNeedsLogin(true);
            setRole(null);
            setMembers([]);
            setLoading(false);
            return;
          }
          throw new Error("Unable to load member access.");
        }

        const data = await res.json();
        if (!active) return;
        setRole((data?.role as Role) ?? null);
        setMembers(Array.isArray(data?.members) ? data.members : []);
        setLoading(false);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Unable to load member access.");
        setLoading(false);
      }
    };

    loadMembers();

    return () => {
      active = false;
    };
  }, [tripId]);

  if (loading) {
    return (
      <p className="text-xs text-gray-500">Loading collaborators...</p>
    );
  }

  if (needsLogin) {
    return (
      <div className="text-xs text-gray-500">
        Sign in to view collaborators.{" "}
        <a href="/login" className="text-teal-300 hover:underline">
          Sign in
        </a>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="text-xs text-gray-500">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
          You are signed in as{" "}
          <span className="font-semibold text-amber-200">
            {currentUserEmail || (currentUserId ? currentUserId.slice(0, 8) : "unknown")}
          </span>{" "}
          but this trip belongs to another account.
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            className="ml-2 rounded-full border border-amber-300/40 px-2 py-0.5 text-[10px] text-amber-100 hover:border-amber-300/70 hover:text-white"
          >
            Switch account
          </button>
        </div>
      </div>
    );
  }

  const isOwner = role === "owner";

  return (
    <div className="space-y-3">
      {isOwner && (
        <div className="flex flex-wrap items-center gap-3">
          <AddMemberButton tripId={tripId} />
          <span className="text-[11px] text-gray-500">
            Invite teammates by link or email.
          </span>
        </div>
      )}
      {isOwner && (
        <TripInvitesPanel tripId={tripId} />
      )}
      <TripMembersPanel
        tripId={tripId}
        members={members}
        canManage={isOwner}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
