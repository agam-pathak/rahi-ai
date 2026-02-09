"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    let active = true;

    const loadMembers = async () => {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!active) return;
        setRole(null);
        setMembers([]);
        setNeedsLogin(true);
        setLoading(false);
        return;
      }

      setNeedsLogin(false);

      const { data: tripData, error: tripError } = await supabase
        .from("trips")
        .select("user_id")
        .eq("id", tripId)
        .single();

      if (tripError || !tripData) {
        if (!active) return;
        setError("Unable to load member access.");
        setLoading(false);
        return;
      }

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
      </div>
    );
  }

  if (!role) {
    return (
      <p className="text-xs text-gray-500">
        You do not have access to collaborators for this trip.
      </p>
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
