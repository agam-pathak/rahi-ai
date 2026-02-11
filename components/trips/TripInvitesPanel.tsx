"use client";

import { useState } from "react";

type InviteRole = "viewer" | "editor";

type InviteResponse = {
  inviteUrl: string;
  token: string;
  role: InviteRole;
  email?: string | null;
};

export default function TripInvitesPanel({ tripId }: { tripId: string }) {
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
      if (!data.inviteUrl) {
        throw new Error("Invite link unavailable.");
      }
      setInvite(data.inviteUrl);
    } catch (err: any) {
      setError(err.message || "Unable to create invite.");
    } finally {
      setLoading(false);
    }
  };

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
            onClick={() =>
              createInvite(
                { role: emailRole, email: email.trim(), mode: "email" },
                setEmailInvite,
                setEmailLoading,
                setEmailError
              )
            }
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

      {copied && <p className="text-[11px] text-teal-300">{copied}</p>}
    </div>
  );
}
