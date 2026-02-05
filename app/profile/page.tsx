"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import RahiBackground from "@/components/RahiBackground";
import ThemeToggle from "@/components/ThemeToggle";
import { CheckCircle2, Lock, LogOut, Mail, ShieldCheck, UserCircle2 } from "lucide-react";

type Profile = {
  id?: string;
  name?: string | null;
  email?: string | null;
  travel_style?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  is_premium?: boolean | null;
  stripe_customer_id?: string | null;
  created_at?: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [emailDraft, setEmailDraft] = useState("");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [credLoading, setCredLoading] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);
  const [credSuccess, setCredSuccess] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch("/api/ai/profile");
        if (!res.ok) {
          setError(
            res.status === 401
              ? "Please sign in to view your profile."
              : "Failed to load profile."
          );
          setLoading(false);
          return;
        }
        const data = (await res.json()) as Profile;
        setProfile(data || {});
        setEmailDraft(data?.email || "");
        setError(null);
      } catch {
        setError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 2500);
    return () => window.clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!credSuccess) return;
    const timer = window.setTimeout(() => setCredSuccess(null), 3000);
    return () => window.clearTimeout(timer);
  }, [credSuccess]);

  const initials = useMemo(() => {
    if (!profile?.name && !profile?.email) return "RA";
    const base = profile?.name || profile?.email || "Rahi";
    return base
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [profile]);

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/ai/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name || "",
          travel_style: profile.travel_style || "",
          bio: profile.bio || "",
          avatar_url: profile.avatar_url || "",
        }),
      });
      if (!res.ok) {
        setError("Failed to save profile.");
        return;
      }
      const data = (await res.json()) as Profile;
      setProfile(data || {});
      setSuccess("Profile updated.");
    } catch {
      setError("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (file?: File | null) => {
    if (!file || !profile?.id) return;
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${profile.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type || "image/jpeg",
        });
      if (uploadError) {
        setAvatarError(uploadError.message || "Upload failed.");
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const avatarUrl = data?.publicUrl;
      if (!avatarUrl) {
        setAvatarError("Failed to retrieve image URL.");
        return;
      }
      const res = await fetch("/api/ai/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: avatarUrl }),
      });
      if (!res.ok) {
        setAvatarError("Failed to save profile photo.");
        return;
      }
      const updated = (await res.json()) as Profile;
      setProfile(updated || { ...profile, avatar_url: avatarUrl });
      setSuccess("Profile photo updated.");
    } catch {
      setAvatarError("Profile photo update failed.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const updateCredentials = async () => {
    if (!profile) return;
    setCredError(null);
    setCredSuccess(null);

    const updates: { email?: string; password?: string } = {};
    if (emailDraft && emailDraft !== profile.email) {
      updates.email = emailDraft.trim();
    }

    if (passwordDraft || passwordConfirm) {
      if (passwordDraft.length < 8) {
        setCredError("Password must be at least 8 characters.");
        return;
      }
      if (passwordDraft !== passwordConfirm) {
        setCredError("Passwords do not match.");
        return;
      }
      updates.password = passwordDraft;
    }

    if (!updates.email && !updates.password) {
      setCredError("No credential changes to update.");
      return;
    }

    setCredLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser(updates);
      if (updateError) {
        setCredError(updateError.message || "Credential update failed.");
        return;
      }
      if (updates.email) {
        setCredSuccess("Check your inbox to confirm the new email.");
        setProfile((prev) => (prev ? { ...prev, email: updates.email } : prev));
      }
      if (updates.password) {
        setCredSuccess((prev) => prev || "Password updated.");
        setPasswordDraft("");
        setPasswordConfirm("");
      }
    } catch {
      setCredError("Credential update failed.");
    } finally {
      setCredLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-teal-300 px-6">
        <div className="rahi-panel px-8 py-6 flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="animate-pulse">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white px-6">
        <div className="rahi-panel px-8 py-6 text-center space-y-4">
          <p className="text-red-200">{error}</p>
          <a href="/login" className="rahi-btn-primary px-4 py-2 text-sm">
            Go to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen bg-black text-white overflow-hidden">
      <RahiBackground />
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div className="rahi-logo flex items-center gap-2 text-lg font-display font-bold text-white">
            <img
              src="/brand/rahi-mark.svg"
              alt="Rahi.AI"
              className="h-8 w-8 rounded-lg border border-white/10 shadow-[0_0_16px_rgba(20,184,166,0.3)]"
            />
            Rahi.AI
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="rahi-btn-secondary text-xs px-3 py-2">
              Home
            </a>
            <ThemeToggle />
          </div>
        </div>

        <div className="rahi-panel p-6 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-teal-500/15 border border-teal-400/20 flex items-center justify-center text-xl font-bold overflow-hidden">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div>
              <div className="text-xl font-display font-bold">
                {profile?.name || "Rahi Traveler"}
              </div>
              <div className="text-sm text-gray-400">{profile?.email || "No email"}</div>
            </div>
          </div>
          <div className="md:ml-auto flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full border border-white/10 text-xs">
              {profile?.is_premium ? "Premium Member" : "Free Explorer"}
            </span>
            {profile?.created_at && (
              <span className="px-3 py-1 rounded-full border border-white/10 text-xs text-gray-400">
                Joined {new Date(profile.created_at).toLocaleDateString("en-IN")}
              </span>
            )}
          </div>
        </div>

        {(error || success) && (
          <div className="rahi-panel px-4 py-3 text-sm">
            {error && <p className="text-red-300">{error}</p>}
            {success && (
              <p className="flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> {success}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rahi-panel p-6 space-y-4">
            <div className="flex items-center gap-2 text-teal-400 font-semibold text-sm uppercase tracking-wide">
              <UserCircle2 className="h-4 w-4" /> Profile details
            </div>

            <div>
              <label className="rahi-label">Full name</label>
              <input
                className="rahi-input mt-2"
                placeholder="Your name"
                value={profile?.name || ""}
                onChange={(e) =>
                  setProfile((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                }
              />
            </div>

            <div>
              <label className="rahi-label">Travel style</label>
              <input
                className="rahi-input mt-2"
                placeholder="Backpacker, Luxury, Student"
                value={profile?.travel_style || ""}
                onChange={(e) =>
                  setProfile((prev) =>
                    prev ? { ...prev, travel_style: e.target.value } : prev
                  )
                }
              />
            </div>

            <div>
              <label className="rahi-label">Bio</label>
              <textarea
                className="rahi-input mt-2 min-h-[120px]"
                placeholder="Tell us about your travel goals."
                value={profile?.bio || ""}
                onChange={(e) =>
                  setProfile((prev) => (prev ? { ...prev, bio: e.target.value } : prev))
                }
              />
            </div>

            <div>
              <label className="rahi-label">Profile photo</label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleAvatarUpload(e.target.files?.[0])}
                  className="text-xs text-gray-300"
                />
                {avatarUploading && (
                  <span className="text-xs text-teal-300">Uploading...</span>
                )}
              </div>
              {avatarError && (
                <p className="text-xs text-red-300 mt-2">{avatarError}</p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Uses the Supabase Storage bucket <span className="text-gray-300">avatars</span>.
              </p>
            </div>

            <button
              onClick={saveProfile}
              disabled={saving}
              className="rahi-btn-primary w-full disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
          </div>

          <div className="rahi-panel p-6 space-y-4">
            <div className="flex items-center gap-2 text-teal-400 font-semibold text-sm uppercase tracking-wide">
              <ShieldCheck className="h-4 w-4" /> Credentials & security
            </div>

            <div>
              <label className="rahi-label">Email</label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <input
                  className="rahi-input pl-10"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Changing email may require confirmation from the new inbox.
              </p>
            </div>

            <div>
              <label className="rahi-label">New password</label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <input
                  className="rahi-input pl-10"
                  type="password"
                  value={passwordDraft}
                  onChange={(e) => setPasswordDraft(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <label className="rahi-label">Confirm password</label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <input
                  className="rahi-input pl-10"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>

            {(credError || credSuccess) && (
              <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-xs">
                {credError && <p className="text-red-300">{credError}</p>}
                {credSuccess && (
                  <p className="text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3" /> {credSuccess}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={updateCredentials}
              disabled={credLoading}
              className="rahi-btn-primary w-full disabled:opacity-60"
            >
              {credLoading ? "Updating..." : "Update credentials"}
            </button>

            <div className="flex items-center justify-between pt-2 text-xs text-gray-500">
              <span>ID: {profile?.id ? profile.id.slice(0, 8) : "—"}</span>
              <button
                onClick={signOut}
                className="rahi-btn-ghost text-[11px]"
              >
                <LogOut className="h-3 w-3" /> Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
