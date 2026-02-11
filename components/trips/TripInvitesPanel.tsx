"use client";

import { useEffect, useState } from "react";

type InviteRole = "viewer" | "editor";

type InviteResponse = {
  inviteUrl: string;
  invite: InviteItem;
  emailSent?: boolean;
  emailError?: string | null;
};

type InviteItem = {
  id: string;
  token: string;
  role: InviteRole;
  email?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  accepted_at?: string | null;
  inviteUrl?: string;
};

export default function TripInvitesPanel({ tripId }: { tripId: string }) {
  const emailInvitesEnabled = process.env.NEXT_PUBLIC_EMAIL_INVITES_ENABLED === "true";
  const [linkRole, setLinkRole] = useState<InviteRole>("viewer");
  const [linkInvite, setLinkInvite] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [emailRole, setEmailRole] = useState<InviteRole>("viewer");
  const [emailInvite, setEmailInvite] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [copied, setCopied] = useState<string | null>(null);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadInvites = async () => {
      setInvitesLoading(true);
      setInvitesError(null);
      try {
        const res = await fetch(`/api/trips/${tripId}/invites`);
        if (!res.ok) {
          throw new Error("Unable to load invites.");
        }
        const data = await res.json();
        if (!active) return;
        setInvites(Array.isArray(data?.invites) ? data.invites : []);
      } catch (err: any) {
        if (!active) return;
        setInvitesError(err?.message || "Unable to load invites.");
      } finally {
        if (active) setInvitesLoading(false);
      }
    };
    loadInvites();
    return () => {
      active = false;
    };
  }, [tripId]);

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied("Link copied.");
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied("Copy failed. Select the link manually.");
      window.setTimeout(() => setCopied(null), 2500);
    }
  };

  const createInvite = async (
    payload: { role: InviteRole; email?: string | null; mode: "link" | "email" },
    setInvite: (value: string | null) => void,
    setLoading: (value: boolean) => void,
    setError: (value: string | null) => void
  ) => {
    let success = false;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as Partial<InviteResponse> & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Unable to create invite");
      }
      if (!data.inviteUrl || !data.invite?.id || !data.invite?.token) {
        throw new Error("Invite link unavailable.");
      }
      const newInvite: InviteItem = {
        id: data.invite.id,
        token: data.invite.token,
        role: data.invite.role === "editor" ? "editor" : "viewer",
        email: data.invite.email ?? null,
        created_at: data.invite.created_at ?? new Date().toISOString(),
        expires_at: data.invite.expires_at ?? null,
        accepted_at: data.invite.accepted_at ?? null,
        inviteUrl: data.inviteUrl,
      };
      setInvite(data.inviteUrl);
      setInvites((prev) => [newInvite, ...prev]);
      if (data.emailSent) {
        setCopied("Email sent.");
      } else if (data.emailError && payload.mode === "email") {
        setError(data.emailError);
      }
      success = true;
    } catch (err: any) {
      setError(err.message || "Unable to create invite.");
    } finally {
      setLoading(false);
    }
    return success;
  };

  const revokeInvite = async (inviteId: string) => {
    setPendingId(inviteId);
    try {
      const res = await fetch(`/api/trips/${tripId}/invites`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Unable to revoke invite.");
      }
      setInvites((prev) => prev.filter((item) => item.id !== inviteId));
    } catch (err: any) {
      setCopied(err?.message || "Unable to revoke invite.");
    } finally {
      setPendingId(null);
    }
  };

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString("en-IN") : "—";

  return (
    <div className="space-y-4 rounded-lg border border-white/5 bg-white/5 p-4">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-teal-200 font-semibold">
          Invite by link
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={linkRole}
            onChange={(event) => setLinkRole(event.target.value as InviteRole)}
            className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-gray-200"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button
            type="button"
            onClick={() =>
              createInvite(
                { role: linkRole, mode: "link" },
                setLinkInvite,
                setLinkLoading,
                setLinkError
              )
            }
            disabled={linkLoading}
            className="rounded-md border border-white/10 px-3 py-1 text-[11px] text-gray-200 hover:border-teal-400/40 disabled:opacity-60"
          >
            {linkLoading ? "Creating..." : "Create link"}
          </button>
        </div>
        {linkInvite && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-300">
            <span className="truncate max-w-[220px]">{linkInvite}</span>
            <button
              type="button"
              onClick={() => copyToClipboard(linkInvite)}
              className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-gray-200 hover:border-teal-400/40"
            >
              Copy
            </button>
          </div>
        )}
        {linkError && <p className="mt-2 text-[11px] text-red-400">{linkError}</p>}
      </div>

      {emailInvitesEnabled && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-teal-200 font-semibold">
            Invite by email
          </div>
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@email.com"
              className="flex-1 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-gray-200 outline-none"
            />
            <select
              value={emailRole}
              onChange={(event) => setEmailRole(event.target.value as InviteRole)}
              className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-gray-200"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
            <button
              type="button"
              onClick={async () => {
                const ok = await createInvite(
                  { role: emailRole, email: email.trim(), mode: "email" },
                  setEmailInvite,
                  setEmailLoading,
                  setEmailError
                );
                if (ok) setEmail("");
              }}
              disabled={emailLoading}
              className="rounded-md border border-white/10 px-3 py-1 text-[11px] text-gray-200 hover:border-teal-400/40 disabled:opacity-60"
            >
              {emailLoading ? "Creating..." : "Create invite"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            Email invites only work for users who sign in with that exact email.
          </p>
          {emailInvite && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-300">
              <span className="truncate max-w-[220px]">{emailInvite}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(emailInvite)}
                className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-gray-200 hover:border-teal-400/40"
              >
                Copy
              </button>
            </div>
          )}
          {emailError && <p className="mt-2 text-[11px] text-red-400">{emailError}</p>}
        </div>
      )}

      <div>
        <div className="text-[11px] uppercase tracking-wide text-teal-200 font-semibold">
          Pending Invites
        </div>
        {invitesLoading ? (
          <p className="mt-2 text-[11px] text-gray-400">Loading invites...</p>
        ) : invitesError ? (
          <p className="mt-2 text-[11px] text-red-400">{invitesError}</p>
        ) : invites.length === 0 ? (
          <p className="mt-2 text-[11px] text-gray-400">No invites yet.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {invites.map((invite) => {
              const now = new Date();
              const expired = invite.expires_at
                ? new Date(invite.expires_at) < now
                : false;
              const accepted = Boolean(invite.accepted_at);
              const status = accepted ? "Accepted" : expired ? "Expired" : "Pending";
              const statusClass = accepted
                ? "bg-emerald-500/15 text-emerald-200"
                : expired
                  ? "bg-amber-500/15 text-amber-200"
                  : "bg-blue-500/15 text-blue-200";

              return (
                <div
                  key={invite.id}
                  className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-gray-200 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm text-gray-100">
                        {invite.email || "Shareable link"}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {invite.role} • Created {formatDate(invite.created_at)}
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusClass}`}>
                      {status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {invite.inviteUrl && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(invite.inviteUrl!)}
                        className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-gray-200 hover:border-teal-400/40"
                      >
                        Copy link
                      </button>
                    )}
                    {!accepted && (
                      <button
                        type="button"
                        onClick={() => revokeInvite(invite.id)}
                        disabled={pendingId === invite.id}
                        className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-gray-200 hover:border-red-400/40 disabled:opacity-60"
                      >
                        {pendingId === invite.id ? "Revoking..." : "Revoke"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {copied && <p className="text-[11px] text-teal-300">{copied}</p>}
    </div>
  );
}
