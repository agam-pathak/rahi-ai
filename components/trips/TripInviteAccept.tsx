"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type InviteInfo = {
  token: string;
  destination: string;
  role: "viewer" | "editor";
  email?: string | null;
  expiresAt?: string | null;
  acceptedAt?: string | null;
  shareCode?: string | null;
};

type Props = {
  invite: InviteInfo;
  isAuthed: boolean;
  userEmail: string | null;
};

export default function TripInviteAccept({ invite, isAuthed, userEmail }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "accepted" | "error" | "forbidden" | "expired" | "already">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(
    invite.shareCode ? `/trip/${invite.shareCode}` : null
  );
  const alreadyAccepted = Boolean(invite.acceptedAt);

  const acceptInvite = async () => {
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch(`/api/invites/${invite.token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.status === 410) {
        setStatus("expired");
        setMessage(data.error || "This invite has expired.");
        return;
      }
      if (res.status === 403) {
        setStatus("forbidden");
        setMessage(data.error || "This invite is for another account.");
        return;
      }
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Unable to accept invite.");
        return;
      }
      if (data.status === "already_accepted") {
        setStatus("already");
      } else {
        setStatus("accepted");
      }
      if (data.share_code) {
        setRedirectUrl(`/trip/${data.share_code}`);
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message || "Unable to accept invite.");
    }
  };

  const signOutAndSwitch = async () => {
    await supabase.auth.signOut();
    window.location.href = `/login?next=/invite/${invite.token}`;
  };

  const needsEmailMatch = invite.email && userEmail && invite.email !== userEmail;

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-300">
        You have been invited to <span className="font-semibold text-white">{invite.destination}</span>{" "}
        as a <span className="text-teal-300 font-semibold">{invite.role}</span>.
      </div>
      {invite.email && (
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-gray-300">
          This invite is tied to <span className="text-teal-200">{invite.email}</span>.
        </div>
      )}

      {!isAuthed && (
        <a
          href={`/login?next=/invite/${invite.token}`}
          className="rahi-btn-primary inline-flex w-full px-4 py-2 text-sm sm:w-auto"
        >
          Sign in to accept
        </a>
      )}

      {isAuthed && needsEmailMatch && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
          You are signed in as {userEmail}. Switch to {invite.email} to accept.
          <button
            type="button"
            onClick={signOutAndSwitch}
            className="mt-2 inline-flex rounded-full border border-amber-300/40 px-2 py-0.5 text-[10px] text-amber-100 hover:border-amber-300/70 hover:text-white sm:ml-2 sm:mt-0"
          >
            Switch account
          </button>
        </div>
      )}

      {isAuthed && !needsEmailMatch && (
        <button
          type="button"
          onClick={acceptInvite}
          disabled={alreadyAccepted || status === "loading" || status === "accepted" || status === "already"}
          className="rahi-btn-primary inline-flex w-full px-4 py-2 text-sm disabled:opacity-60 sm:w-auto"
        >
          {alreadyAccepted ? "Already accepted" : status === "loading" ? "Accepting..." : "Accept invite"}
        </button>
      )}

      {redirectUrl && (
        <a href={redirectUrl} className="rahi-btn-secondary inline-flex w-full px-4 py-2 text-sm sm:w-auto">
          Open trip
        </a>
      )}

      {status === "already" && (
        <p className="text-[11px] text-gray-400">Invite already accepted. You can open the trip.</p>
      )}
      {alreadyAccepted && status === "idle" && (
        <p className="text-[11px] text-gray-400">This invite was already accepted.</p>
      )}
      {status === "accepted" && (
        <p className="text-[11px] text-teal-300">Invite accepted. Welcome aboard!</p>
      )}
      {status === "expired" && (
        <p className="text-[11px] text-red-400">{message}</p>
      )}
      {status === "forbidden" && (
        <p className="text-[11px] text-amber-300">{message}</p>
      )}
      {status === "error" && (
        <p className="text-[11px] text-red-400">{message}</p>
      )}
    </div>
  );
}
