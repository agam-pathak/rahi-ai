"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AddMemberButton from "./AddMemberButton";
import TripMembersPanel from "./TripMembersPanel";

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
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const showDebug =
    searchParams?.get("debug") === "1" || searchParams?.get("debug") === "true";

  useEffect(() => {
    let active = true;

    const loadMembers = async () => {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!active) return;
        setCurrentUserId(null);
        setOwnerId(null);
        setRole(null);
        setMembers([]);
        setNeedsLogin(true);
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);
      setNeedsLogin(false);

      const { data: tripData, error: tripError } = await supabase
        .from("trips")
        .select("user_id")
        .eq("id", tripId)
        .single();

      if (tripError || !tripData) {
        if (!active) return;
        setError("Unable to load member access.");
        setOwnerId(null);
        setLoading(false);
        return;
      }

      setOwnerId(tripData.user_id ?? null);
      let resolvedRole: Role = null;
      if (tripData.user_id === user.id) {
        resolvedRole = "owner";
      } else {
        const { data: memberRow } = await supabase
          .from("trip_members")
          .select("role")
          .eq("trip_id", tripId)
          .eq("user_id", user.id)
          .maybeSingle();
        resolvedRole = (memberRow?.role as Role) ?? null;
      }

      if (!active) return;
      setRole(resolvedRole);

      if (!resolvedRole) {
        setMembers([]);
        setLoading(false);
        return;
      }

      const { data: memberRows, error: membersError } = await supabase
        .from("trip_members")
        .select("user_id, role, created_at")
        .eq("trip_id", tripId);

      if (!active) return;
      if (membersError) {
        setError("Unable to load members.");
        setLoading(false);
        return;
      }

      const normalized = (memberRows ?? []).map((member) => ({
        ...member,
        profiles: null,
      })) as Member[];
      setMembers(normalized);
      setLoading(false);
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
        {showDebug && (
          <div className="mt-2 text-[10px] text-gray-500">
            Debug: owner {ownerId ? ownerId.slice(0, 8) : "—"} · you{" "}
            {currentUserId ? currentUserId.slice(0, 8) : "—"}
          </div>
        )}
      </div>
    );
  }

  if (!role) {
    return (
      <div className="text-xs text-gray-500">
        You do not have access to collaborators for this trip.
        {showDebug && (
          <div className="mt-2 text-[10px] text-gray-500">
            Debug: owner {ownerId ? ownerId.slice(0, 8) : "—"} · you{" "}
            {currentUserId ? currentUserId.slice(0, 8) : "—"}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {role === "owner" && (
        <AddMemberButton tripId={tripId} />
      )}
      <TripMembersPanel
        tripId={tripId}
        members={members}
        canManage={role === "owner"}
      />
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </>
  );
}
