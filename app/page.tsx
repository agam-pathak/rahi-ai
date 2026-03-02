"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Compass,
  Wallet,
  Bot,
  ChevronDown,
  ArrowRight,
  Globe,
  Star,
  Settings,
  Sparkles,
  Radar,
  Route,
  ShieldCheck,
  Clock3,
  CheckCircle2,
} from "lucide-react";
import RahiBackground from "@/components/RahiBackground";
import ThemeToggle from "@/components/ThemeToggle";
import RahiVoiceUI, { speakWithHeart } from "@/components/RahiVoiceUI";

type CommandProfileId = "solo" | "college" | "family";

type CommandLane = {
  label: string;
  detail: string;
  value: number;
  gradient: string;
};

type CommandProfile = {
  id: CommandProfileId;
  title: string;
  tagline: string;
  destination: string;
  duration: string;
  budget: string;
  command: string;
  launchHref: string;
  checkpoints: string[];
  lanes: CommandLane[];
};

const COMMAND_PROFILE_ORDER: CommandProfileId[] = ["solo", "college", "family"];

const COMMAND_PROFILES: Record<CommandProfileId, CommandProfile> = {
  solo: {
    id: "solo",
    title: "Solo Sprint",
    tagline: "Fast, flexible, and photo-ready routes.",
    destination: "Udaipur",
    duration: "3D / 2N",
    budget: "₹11,500",
    command:
      "Build a 3-day solo Udaipur itinerary under 12k with sunrise spots, safe evening areas, and low transit switching.",
    launchHref: "/planner?mode=ai&type=solo",
    checkpoints: [
      "Late-evening safety buffers in every day plan",
      "Walking-first path sequencing with fallback transport",
      "Experience density balanced against recovery windows",
    ],
    lanes: [
      {
        label: "Route Confidence",
        detail: "Sequence quality across city zones",
        value: 94,
        gradient: "linear-gradient(90deg, #2dd4bf 0%, #67e8f9 100%)",
      },
      {
        label: "Budget Guardrail",
        detail: "Cost drift vs target budget",
        value: 89,
        gradient: "linear-gradient(90deg, #22d3ee 0%, #7dd3fc 100%)",
      },
      {
        label: "Safety Buffer",
        detail: "Late-hour fallback density",
        value: 91,
        gradient: "linear-gradient(90deg, #6ee7b7 0%, #5eead4 100%)",
      },
    ],
  },
  college: {
    id: "college",
    title: "College Crew",
    tagline: "High-energy itineraries without budget chaos.",
    destination: "Goa",
    duration: "4D / 3N",
    budget: "₹17,800",
    command:
      "Plan a 4-day Goa college trip with beach mornings, budget nightlife clusters, and one premium highlight under 18k each.",
    launchHref: "/planner?mode=budget&type=college",
    checkpoints: [
      "Shared transfer windows to cut duplicate ride spend",
      "Nightlife and café clusters kept in one mobility band",
      "One splurge experience protected without breaking total budget",
    ],
    lanes: [
      {
        label: "Group Sync",
        detail: "Decision alignment across members",
        value: 90,
        gradient: "linear-gradient(90deg, #2dd4bf 0%, #93c5fd 100%)",
      },
      {
        label: "Spend Control",
        detail: "Variance from per-person target",
        value: 92,
        gradient: "linear-gradient(90deg, #6ee7b7 0%, #67e8f9 100%)",
      },
      {
        label: "Energy Curve",
        detail: "Pacing from day one to four",
        value: 87,
        gradient: "linear-gradient(90deg, #67e8f9 0%, #7dd3fc 100%)",
      },
    ],
  },
  family: {
    id: "family",
    title: "Family Comfort",
    tagline: "Comfort-first planning with low-friction logistics.",
    destination: "Kerala",
    duration: "5D / 4N",
    budget: "₹39,000",
    command:
      "Create a 5-day Kerala family itinerary with low transit fatigue, child-friendly stops, and weather-safe indoor alternatives.",
    launchHref: "/planner?mode=ai&type=family",
    checkpoints: [
      "Midday cooldown windows built into every day",
      "Backup indoor experiences for uncertain weather",
      "Transfer-time caps to reduce travel fatigue",
    ],
    lanes: [
      {
        label: "Comfort Index",
        detail: "Transit load and rest spacing",
        value: 93,
        gradient: "linear-gradient(90deg, #5eead4 0%, #86efac 100%)",
      },
      {
        label: "Weather Resilience",
        detail: "Indoor fallback plan coverage",
        value: 88,
        gradient: "linear-gradient(90deg, #67e8f9 0%, #93c5fd 100%)",
      },
      {
        label: "Family Fit",
        detail: "Activity suitability by pace",
        value: 95,
        gradient: "linear-gradient(90deg, #86efac 0%, #67e8f9 100%)",
      },
    ],
  },
};

export default function Home() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [user, setUser] = useState<User | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [navCompact, setNavCompact] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuFirstItemRef = useRef<HTMLAnchorElement | null>(null);
  const premiumEase = [0.16, 1, 0.3, 1] as const;
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false);
  const [voiceNote, setVoiceNote] = useState("");
  const [voiceSettings, setVoiceSettings] = useState({
    tts: true,
    earcons: true,
    autoSend: true,
    lang: "en-IN" as "en-IN" | "hi-IN",
  });
  const [activeCommandProfile, setActiveCommandProfile] =
    useState<CommandProfileId>("solo");
  const [commandCopied, setCommandCopied] = useState(false);

  // --- AUTHENTICATION LOGIC ---
  useEffect(() => {
    let active = true;
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setUser(data.session?.user ?? null);
    };
    void loadSession();
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        setUser(session?.user ?? null);
      }
    );
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const loadProfile = async () => {
      try {
        const res = await fetch("/api/ai/profile");
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setProfileAvatar(data?.avatar_url || null);
        setProfileName(data?.name || data?.email || null);
      } catch (error) {
        console.error("Failed to load profile:", error);
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    const onScroll = () => {
      setNavCompact(window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!avatarMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!avatarMenuRef.current) return;
      if (!avatarMenuRef.current.contains(event.target as Node)) {
        setAvatarMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAvatarMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [avatarMenuOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("rahi-voice-settings");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setVoiceSettings((prev) => ({
          ...prev,
          ...parsed,
          lang: parsed?.lang === "hi-IN" ? "hi-IN" : "en-IN",
        }));
      } catch {
        window.localStorage.removeItem("rahi-voice-settings");
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("rahi-voice-settings", JSON.stringify(voiceSettings));
  }, [voiceSettings]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const profileAvatarUrl =
    profileAvatar || (user?.user_metadata?.avatar_url as string | undefined) || null;

  const profileInitials = useMemo(() => {
    const raw =
      profileName ||
      (user?.user_metadata?.full_name as string | undefined) ||
      user?.email ||
      "Rahi";
    const cleaned = String(raw || "").trim();
    if (!cleaned) return "RA";
    const base = cleaned.includes("@") ? cleaned.split("@")[0] : cleaned;
    const parts = base.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }, [profileName, user]);

  const activeCommandPlan = COMMAND_PROFILES[activeCommandProfile];
  const plannerEntryHref = user
    ? "/planner?mode=ai"
    : "/login?next=%2Fplanner%3Fmode%3Dai";

  const speakResponse = (text: string) => {
    if (!voiceSettings.tts) return;
    speakWithHeart(
      text,
      voiceSettings.lang,
      undefined,
      undefined,
      () => setVoiceStatus("speaking"),
      () => setVoiceStatus("idle")
    );
  };

  const announce = (text: string) => {
    setVoiceNote(text);
    if (!voiceSettings.tts) {
      setVoiceStatus("idle");
      return;
    }
    speakResponse(text);
  };

  useEffect(() => {
    setCommandCopied(false);
  }, [activeCommandProfile]);

  const copyMissionCommand = async () => {
    try {
      await navigator.clipboard.writeText(activeCommandPlan.command);
      setCommandCopied(true);
      setVoiceNote("Mission prompt copied.");
    } catch {
      setVoiceNote("Could not copy prompt.");
    }
  };

  const guardedPush = (url: string) => {
    if (!user && url.startsWith("/planner")) {
      router.push(`/login?next=${encodeURIComponent(url)}`);
      return;
    }
    router.push(url);
  };

  const handleVoiceCommand = (text: string) => {
    const lower = text.toLowerCase();
    setVoiceStatus("thinking");

    const go = (url: string, message: string) => {
      announce(message);
      guardedPush(url);
    };

    if (/logout|log out|sign out/.test(lower)) {
      announce("Signing you out now.");
      logout();
      return;
    }

    if (/planner|plan|itinerary|trip/.test(lower)) {
      go("/planner?mode=ai", "Opening the AI trip planner.");
      return;
    }

    if (/budget|spend|cost/.test(lower)) {
      go("/planner?mode=budget", "Opening Budget Guardian.");
      return;
    }

    if (/chat|buddy|assistant|companion/.test(lower)) {
      go("/planner?mode=chat", "Opening your AI travel buddy.");
      return;
    }

    if (/features/.test(lower)) {
      document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
      announce("Here are the features.");
      return;
    }

    if (/community|footer|contact/.test(lower)) {
      document.getElementById("community")?.scrollIntoView({ behavior: "smooth" });
      announce("Scrolling to the community section.");
      return;
    }

    if (/top|home|hero/.test(lower)) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      announce("Back to the top.");
      return;
    }

    announce("Try saying: plan a trip, open budget, or open chat.");
  };

  // --- ANIMATION VARIANTS (TS Fixed) ---
  const containerVariants: Variants = shouldReduceMotion
    ? {
        hidden: { opacity: 1 },
        visible: { opacity: 1 },
      }
    : {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.15, delayChildren: 0.1 },
        },
      };

  const itemVariants: Variants = shouldReduceMotion
    ? {
        hidden: { opacity: 1, y: 0 },
        visible: { opacity: 1, y: 0 },
      }
    : {
        hidden: { y: 20, opacity: 0 },
        visible: {
          y: 0,
          opacity: 1,
          transition: {
            duration: 0.7,
            ease: premiumEase,
          },
        },
      };

  return (
    <main className="relative min-h-screen bg-black text-white overflow-hidden selection:bg-teal-500 selection:text-white">
      
      <RahiBackground />

      {/* 2. GLASS NAVBAR */}
      <nav
        className={`fixed top-0 w-full z-50 border-b border-rahi-border bg-rahi-surface backdrop-blur-xl transition-all duration-300 ${
          navCompact ? "shadow-[0_12px_30px_rgba(2,6,23,0.45)] bg-rahi-surface-strong" : ""
        }`}
      >
        <div
          className={`max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between transition-all duration-300 ${
            navCompact ? "h-14 md:h-16" : "h-16 md:h-20"
          }`}
        >
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rahi-logo"
          >
            <Link href="/" aria-label="Rahi.AI" className="inline-flex items-center gap-3">
              <span className="rahi-logo-badge h-11 w-11 rounded-2xl border border-white/10 bg-black/40">
                <Image
                  src="/brand/rahi-mark.svg"
                  alt="Rahi.AI mark"
                  width={40}
                  height={40}
                  className="h-10 w-10"
                />
              </span>
              <svg
                className="rahi-wordmark"
                viewBox="0 0 180 40"
                role="img"
                aria-hidden="true"
              >
                <text x="0" y="28">Rahi.AI</text>
              </svg>
            </Link>
          </motion.div>

          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 md:gap-6 text-sm font-medium text-gray-200"
          >
            <div className="hidden md:flex items-center gap-8">
              <button
                onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                className="hover:text-teal-300 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400/60 focus-visible:outline-offset-4"
              >
                Features
              </button>
              <button
                onClick={() => document.getElementById("community")?.scrollIntoView({ behavior: "smooth" })}
                className="hover:text-teal-300 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400/60 focus-visible:outline-offset-4"
              >
                Community
              </button>
            </div>

            <Link href={plannerEntryHref} className="rahi-btn-secondary px-3 py-2 text-xs md:px-5 md:py-2.5 md:text-sm border-white/20">
              <span className="md:hidden">Plan</span>
              <span className="hidden md:inline">Start Planning</span>
            </Link>

            {user ? (
              <div className="relative" ref={avatarMenuRef}>
                <button
                  id="home-profile-menu-button"
                  type="button"
                  aria-label="Profile menu"
                  aria-haspopup="menu"
                  aria-controls="home-profile-menu"
                  aria-expanded={avatarMenuOpen}
                  onClick={() => setAvatarMenuOpen((prev) => !prev)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setAvatarMenuOpen(true);
                      window.setTimeout(() => profileMenuFirstItemRef.current?.focus(), 0);
                    }
                  }}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 ring-2 ring-teal-400/30 hover:ring-teal-400/60 transition"
                >
                  {profileAvatarUrl ? (
                    <img
                      src={profileAvatarUrl}
                      alt="Profile"
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-[12px] font-semibold text-gray-200">
                      {profileInitials}
                    </span>
                  )}
                </button>
                {avatarMenuOpen && (
                  <motion.div
                    id="home-profile-menu"
                    role="menu"
                    aria-labelledby="home-profile-menu-button"
                    initial={shouldReduceMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="absolute right-0 mt-3 w-64 rounded-2xl border border-white/10 bg-[#0b1220]/95 p-3 shadow-xl backdrop-blur"
                  >
                    <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                      <div className="h-10 w-10 rounded-full border border-white/10 bg-white/5 overflow-hidden">
                        {profileAvatarUrl ? (
                          <img src={profileAvatarUrl} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs text-gray-300">
                            {profileInitials}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {profileName || user.email || "Rahi Traveler"}
                        </div>
                        <div className="text-[11px] text-gray-400">Account</div>
                      </div>
                    </div>
                    <div className="py-3 space-y-1">
                      <Link
                        ref={profileMenuFirstItemRef}
                        role="menuitem"
                        href="/profile"
                        onClick={() => setAvatarMenuOpen(false)}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-200 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400/60"
                      >
                        Profile
                        <ArrowRight className="h-4 w-4 text-gray-500" />
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={logout}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-rose-200 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400/60"
                      >
                        Logout
                        <ArrowRight className="h-4 w-4 text-rose-200/70" />
                      </button>
                    </div>
                    <div className="border-t border-white/10 pt-3">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                        Appearance
                      </div>
                      <div className="mt-2 origin-left scale-90">
                        <ThemeToggle />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex h-11 items-center rounded-full border border-cyan-300/35 bg-cyan-500/10 px-4 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/55 hover:text-white"
              >
                Sign in
              </Link>
            )}
          </motion.div>
        </div>
      </nav>

      {/* 3. HERO SECTION */}
      <section className="relative z-20 min-h-screen px-4 pt-20 md:pt-16 pb-10 md:pb-12 flex items-center">
        <div className="rahi-hero-watermark" aria-hidden="true">
          <span>RAHI.AI</span>
        </div>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 w-full max-w-7xl mx-auto grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-12 items-center"
        >
          <div className="space-y-6 text-center lg:text-left">
            {/* The "Future of Travel" Badge */}
            <motion.div variants={itemVariants} className="inline-block">
              <span className="py-1 px-4 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-bold tracking-wider uppercase backdrop-blur-md">
                The Future of Travel
              </span>
            </motion.div>

            {/* Massive Headline */}
            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-5xl md:text-6xl xl:text-7xl font-display font-black tracking-tight leading-[0.98]"
            >
              Travel Smart with <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-300 drop-shadow-[0_0_35px_rgba(45,212,191,0.4)]">
                Rahi.AI
              </span>
            </motion.h1>

            {/* Subtext */}
            <motion.p
              variants={itemVariants}
              className="text-lg md:text-2xl text-gray-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed"
            >
              Plan smarter trips. Save money. Travel confidently with your personal AI companion.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2"
            >
              <button
                className="rahi-btn-primary px-6 py-3 text-sm"
                onClick={() => guardedPush("/planner?mode=ai")}
              >
                Start Planning <ArrowRight className="h-4 w-4" />
              </button>
              <button
                className="rahi-btn-secondary group px-6 py-3 text-sm"
                onClick={() => guardedPush("/planner?mode=ai&sample=1")}
              >
                See Sample Trip
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="flex flex-wrap items-center justify-center lg:justify-start gap-3 text-xs md:text-sm text-gray-400 pt-1"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                AI plans
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Budget smart
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Student friendly
              </span>
            </motion.div>
          </div>

          <motion.div variants={itemVariants} className="w-full max-w-[560px] mx-auto lg:ml-auto space-y-4">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/35 shadow-[0_18px_45px_rgba(2,6,23,0.45)]">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/15 via-transparent to-cyan-400/10 pointer-events-none" />
              <div className="absolute inset-0 bg-black/20 pointer-events-none" />
              <div className="absolute left-4 right-4 top-4 z-10 inline-flex items-center justify-between rounded-2xl border border-white/10 bg-black/45 px-3 py-2 backdrop-blur">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/80">Live Mission</p>
                  <p className="text-xs font-semibold text-white">{activeCommandPlan.title}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  stable
                </span>
              </div>
              <div className="relative aspect-[16/10] overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(45,212,191,0.4),transparent_42%),radial-gradient(circle_at_80%_75%,rgba(56,189,248,0.32),transparent_44%),linear-gradient(160deg,rgba(15,23,42,0.95),rgba(2,6,23,0.96))]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:34px_34px] opacity-45" />
                <div className="relative z-[1] flex h-full items-end p-5 sm:p-6">
                  <div className="w-full rounded-2xl border border-cyan-300/25 bg-black/45 p-4 backdrop-blur">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/85">
                      Mission Snapshot
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {activeCommandPlan.destination} route with budget guardrails and fallback checkpoints.
                    </p>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-4 left-4 right-4 z-10 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-black/55 px-2.5 py-2 backdrop-blur">
                  <p className="text-[9px] uppercase tracking-[0.16em] text-slate-300">Destination</p>
                  <p className="mt-1 text-xs font-semibold text-white">{activeCommandPlan.destination}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/55 px-2.5 py-2 backdrop-blur">
                  <p className="text-[9px] uppercase tracking-[0.16em] text-slate-300">Duration</p>
                  <p className="mt-1 text-xs font-semibold text-white">{activeCommandPlan.duration}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/55 px-2.5 py-2 backdrop-blur">
                  <p className="text-[9px] uppercase tracking-[0.16em] text-slate-300">Budget</p>
                  <p className="mt-1 text-xs font-semibold text-white">{activeCommandPlan.budget}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { label: "Route Graph", value: "97 nodes", icon: Route },
                { label: "Risk Scan", value: "Low", icon: ShieldCheck },
                { label: "ETA Sync", value: "Live", icon: Radar },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2.5 backdrop-blur"
                >
                  <div className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-400/10 text-cyan-200">
                    <metric.icon className="h-3.5 w-3.5" />
                  </div>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                    {metric.label}
                  </p>
                  <p className="text-sm font-semibold text-slate-100">{metric.value}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div 
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: [0, 10, 0] }}
          transition={
            shouldReduceMotion
              ? { duration: 0.2 }
              : { delay: 2, duration: 2, repeat: Infinity, ease: "easeInOut" }
          }
          className="absolute bottom-10 left-1/2 hidden -translate-x-1/2 sm:block"
        >
          <div className="flex flex-col items-center gap-2 text-gray-400 text-sm">
            <span>Scroll to explore</span>
            <ChevronDown className="h-5 w-5" />
          </div>
        </motion.div>
      </section>

      {/* VOICE CONCIERGE */}
      <section id="voice" className="relative z-20 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-bold tracking-wider uppercase">
              <Sparkles className="h-4 w-4" />
              Rahi Voice Concierge
            </div>
            <h2 className="text-3xl font-display font-bold text-white sm:text-4xl md:text-5xl">
              Speak your trip into existence.
            </h2>
            <p className="max-w-xl text-base text-gray-300 sm:text-lg">
              Your home base voice assistant can launch planners, budgets, and travel chats instantly.
              It is fast, focused, and tuned for Rahi.AI tasks.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                className="rahi-btn-primary px-5 py-3 text-sm"
                onClick={() => guardedPush("/planner?mode=ai")}
              >
                Start Planning <ArrowRight className="h-4 w-4" />
              </button>
              <button
                className="rahi-btn-secondary"
                onClick={() => guardedPush("/planner?mode=budget")}
              >
                Budget Guardian
              </button>
              <button
                className="rahi-btn-secondary"
                onClick={() => guardedPush("/planner?mode=chat")}
              >
                AI Travel Buddy
              </button>
            </div>
            <div className="rahi-voice-hints">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Try saying</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  "Plan my trip",
                  "Open budget",
                  "Open chat",
                  "Show features",
                  "Go to community",
                ].map((hint) => (
                  <span key={hint} className="rahi-voice-chip">{hint}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="rahi-voice-console">
            <div className="rahi-voice-console-header">
              <div>
                <p className="text-sm font-semibold text-white">Voice Control</p>
                <p className="text-xs text-gray-400">Premium guidance, instant redirects.</p>
              </div>
              <button
                className="rahi-btn-ghost"
                onClick={() => setVoiceSettingsOpen((prev) => !prev)}
              >
                <Settings className="h-4 w-4" />
                {voiceSettingsOpen ? "Hide" : "Settings"}
              </button>
            </div>

            <RahiVoiceUI
              onText={handleVoiceCommand}
              onListening={(isListening) => {
                setVoiceStatus((prev) =>
                  isListening ? "listening" : prev === "listening" ? "idle" : prev
                );
              }}
              status={voiceStatus}
              lang={voiceSettings.lang}
              autoSend={voiceSettings.autoSend}
              earcons={voiceSettings.earcons}
            />

            {voiceNote && (
              <div className="rahi-voice-feedback">
                <p className="text-xs text-teal-200 uppercase tracking-[0.2em]">Assistant</p>
                <p className="text-sm text-white mt-1">{voiceNote}</p>
              </div>
            )}

            {voiceSettingsOpen && (
              <div className="rahi-voice-controls">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Voice Replies</p>
                    <p className="text-xs text-gray-400">Speak confirmations aloud.</p>
                  </div>
                  <button
                    className={`rahi-toggle ${voiceSettings.tts ? "is-on" : ""}`}
                    onClick={() => setVoiceSettings((prev) => ({ ...prev, tts: !prev.tts }))}
                    type="button"
                  >
                    <span className="sr-only">Toggle voice replies</span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Earcon Chimes</p>
                    <p className="text-xs text-gray-400">Soft cues on start/send.</p>
                  </div>
                  <button
                    className={`rahi-toggle ${voiceSettings.earcons ? "is-on" : ""}`}
                    onClick={() => setVoiceSettings((prev) => ({ ...prev, earcons: !prev.earcons }))}
                    type="button"
                  >
                    <span className="sr-only">Toggle earcons</span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Auto Send</p>
                    <p className="text-xs text-gray-400">Send after short pause.</p>
                  </div>
                  <button
                    className={`rahi-toggle ${voiceSettings.autoSend ? "is-on" : ""}`}
                    onClick={() => setVoiceSettings((prev) => ({ ...prev, autoSend: !prev.autoSend }))}
                    type="button"
                  >
                    <span className="sr-only">Toggle auto send</span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Language</p>
                    <p className="text-xs text-gray-400">Recognition preference.</p>
                  </div>
                  <select
                    className="rahi-select"
                    value={voiceSettings.lang}
                    onChange={(e) =>
                      setVoiceSettings((prev) => ({
                        ...prev,
                        lang: e.target.value === "hi-IN" ? "hi-IN" : "en-IN",
                      }))
                    }
                  >
                    <option value="en-IN">English (IN)</option>
                    <option value="hi-IN">Hindi (IN)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. MISSION CONTROL */}
      <section id="mission-control" className="relative z-20 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="rahi-panel p-6 md:p-8 lg:p-10">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
                <Radar className="h-4 w-4" />
                Mission Control
              </span>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-white">
                Build routes like an operations desk.
              </h2>
              <p className="max-w-2xl text-sm md:text-base text-slate-300">
                Switch traveler profiles and watch routing, budget, and risk lanes rebalance in real
                time before you launch into planner mode.
              </p>
            </div>
            <button
              className="rahi-btn-secondary text-xs"
              onClick={() => guardedPush(activeCommandPlan.launchHref)}
            >
              Launch {activeCommandPlan.title}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {COMMAND_PROFILE_ORDER.map((profileId) => {
                  const profile = COMMAND_PROFILES[profileId];
                  const active = profileId === activeCommandProfile;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => setActiveCommandProfile(profile.id)}
                      className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                        active
                          ? "border-cyan-300/50 bg-cyan-500/15 text-white shadow-[0_14px_36px_-24px_rgba(34,211,238,0.85)]"
                          : "border-white/15 bg-slate-950/45 text-slate-200 hover:border-cyan-300/30 hover:text-white"
                      }`}
                    >
                      <p className="text-sm font-semibold">{profile.title}</p>
                      <p className="mt-1 text-xs text-slate-300">{profile.tagline}</p>
                    </button>
                  );
                })}
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-slate-950/55 p-5 md:p-6">
                <div className="absolute -left-20 top-0 h-44 w-44 rounded-full bg-cyan-400/15 blur-3xl" />
                <div className="absolute -right-24 bottom-0 h-44 w-44 rounded-full bg-teal-300/10 blur-3xl" />
                <div className="relative">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/80">
                    Command Prompt
                  </p>
                  <p className="mt-3 rounded-2xl border border-cyan-300/25 bg-black/40 px-4 py-4 font-mono text-sm leading-relaxed text-cyan-100">
                    {activeCommandPlan.command}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="rahi-btn-primary text-sm"
                      onClick={() => guardedPush(activeCommandPlan.launchHref)}
                    >
                      Run Mission
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rahi-btn-secondary text-sm"
                      onClick={() => void copyMissionCommand()}
                    >
                      {commandCopied ? "Prompt Copied" : "Copy Prompt"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Destination", value: activeCommandPlan.destination, icon: Route },
                  { label: "Duration", value: activeCommandPlan.duration, icon: Clock3 },
                  { label: "Budget", value: activeCommandPlan.budget, icon: Wallet },
                ].map((detail) => (
                  <div
                    key={detail.label}
                    className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3"
                  >
                    <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-400/10 text-cyan-200">
                      <detail.icon className="h-4 w-4" />
                    </div>
                    <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                      {detail.label}
                    </p>
                    <p className="text-sm font-semibold text-white">{detail.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-white/15 bg-slate-950/55 p-5 md:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  Execution Lanes
                </p>
                <div className="mt-4 space-y-4">
                  {activeCommandPlan.lanes.map((lane) => (
                    <div key={`${activeCommandProfile}-${lane.label}`} className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{lane.label}</p>
                          <p className="text-xs text-slate-400">{lane.detail}</p>
                        </div>
                        <p className="text-sm font-semibold text-cyan-200">{lane.value}%</p>
                      </div>
                      <div className="h-2 rounded-full bg-slate-900/90 ring-1 ring-white/10">
                        <motion.div
                          key={`${activeCommandProfile}-${lane.label}-bar`}
                          initial={shouldReduceMotion ? false : { width: 0 }}
                          animate={{ width: `${lane.value}%` }}
                          transition={
                            shouldReduceMotion
                              ? { duration: 0.1 }
                              : { duration: 0.7, ease: premiumEase }
                          }
                          className="h-full rounded-full"
                          style={{ background: lane.gradient }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/15 bg-slate-950/50 p-5 md:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">
                  Mission Checklist
                </p>
                <ul className="mt-3 space-y-2">
                  {activeCommandPlan.checkpoints.map((checkpoint) => (
                    <li key={checkpoint} className="flex gap-2 text-sm text-slate-200">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      <span>{checkpoint}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-200/85">
                    Confidence Note
                  </p>
                  <p className="mt-1 text-sm text-cyan-100">
                    Rahi continuously balances speed, comfort, and cost so every generated itinerary
                    is launch-ready in one pass.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FEATURES (Your Content) */}
      <section id="features" className="relative z-20 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard 
            icon={<Compass className="h-8 w-8 text-teal-400" />}
            title="AI Trip Planner"
            desc="Personalized travel plans within your budget."
            eyebrow="Neural Route Engine"
            signal="Drafts first plan in under a minute"
            actionLabel="Open Planner"
            onClick={() => guardedPush("/planner?mode=ai")}
            reducedMotion={!!shouldReduceMotion}
            color="hover:border-teal-500/50"
          />
          <FeatureCard 
            icon={<Wallet className="h-8 w-8 text-teal-400" />}
            title="Budget Guardian"
            desc="Track and control your travel expenses."
            eyebrow="Spend Intelligence"
            signal="Flags budget drift before it compounds"
            actionLabel="Open Budget"
            onClick={() => guardedPush("/planner?mode=budget")}
            reducedMotion={!!shouldReduceMotion}
            color="hover:border-teal-500/50"
          />
          <FeatureCard 
            icon={<Bot className="h-8 w-8 text-teal-400" />}
            title="AI Travel Buddy"
            desc="Chat with your AI companion anytime."
            eyebrow="Context Memory"
            signal="Remembers your vibe, pace, and constraints"
            actionLabel="Open Chat"
            onClick={() => guardedPush("/planner?mode=chat")}
            reducedMotion={!!shouldReduceMotion}
            color="hover:border-teal-500/50"
          />
        </div>
      </section>

      {/* 6. HOW IT WORKS */}
      <section className="relative z-20 mx-auto max-w-5xl border-t border-white/5 px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeader title="How Rahi.AI Works" />
        
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {["Plan", "Generate", "Travel", "Save"].map((step, i) => (
            <motion.div 
              key={i}
              whileHover={shouldReduceMotion ? undefined : { y: -5 }}
            className="rahi-card cursor-default rounded-2xl p-6 text-center transition-all hover:bg-white/10 sm:p-8"
          >
              <span className="block text-4xl font-bold text-teal-500/80 mb-2">{i + 1}</span>
              <span className="text-lg font-medium text-white">{step}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 7. BENEFITS */}
      <section className="relative z-20 mx-auto max-w-7xl border-t border-white/5 px-4 py-16 sm:px-6 sm:py-24">
         <div className="grid md:grid-cols-3 gap-8"> 
           {[
            ["AI Optimized Budgets","Trips planned with smart cost control."],
            ["Local Experience Focus","Discover food, culture and hidden places."],
            ["Student Friendly","Designed for real student travel needs."]
          ].map(([t,d],i)=>(
            <div key={i}
              className="rahi-card rounded-2xl p-6
              hover:border-teal-500/50 hover:shadow-[0_0_20px_rgba(20,184,166,0.1)]
              transition-all duration-300 backdrop-blur-sm cursor-default sm:p-10">
              <h3 className="text-teal-400 font-semibold text-xl mb-2">{t}</h3>
              <p className="text-gray-400 leading-relaxed">{d}</p>
            </div>
          ))}
         </div>
      </section>

      {/* 8. WHAT YOU CAN PLAN */}
      <section className="relative z-20 mx-auto max-w-7xl border-t border-white/5 px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeader title="What You Can Plan with Rahi.AI" />

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { t: "Solo Trips", v: "solo" },
            { t: "College Trips", v: "college" },
            { t: "Family Trips", v: "family" },
            { t: "Budget Trips", v: "budget" },
            { t: "Adventure", v: "adventure" }
          ].map((item, i) => (
            <motion.button
              key={i}
              onClick={() => guardedPush(`/planner?type=${item.v}`)}
              whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
              className="group flex flex-col items-center justify-center gap-3 rounded-2xl p-6 transition-all hover:border-teal-500/50 hover:bg-teal-500/20 rahi-card sm:p-8"
            >
              <span className="text-lg font-semibold text-gray-200 group-hover:text-white">{item.t}</span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* 9. TESTIMONIALS */}
      <section className="relative z-20 mx-auto max-w-7xl border-t border-white/5 px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeader title="Loved by Travelers" />
        
        <div className="grid md:grid-cols-3 gap-8 mt-12">
          {[
            "Saved ₹3000 on my trip.",
            "First solo trip felt easy.",
            "Planning became stress free."
          ].map((q, i) => (
            <motion.div
              key={i}
              whileHover={shouldReduceMotion ? undefined : { y: -5 }}
              className="rahi-card p-8 rounded-2xl backdrop-blur-sm"
            >
              <div className="flex gap-1 mb-4 text-teal-400">
                <Star className="h-4 w-4 fill-current" />
                <Star className="h-4 w-4 fill-current" />
                <Star className="h-4 w-4 fill-current" />
                <Star className="h-4 w-4 fill-current" />
                <Star className="h-4 w-4 fill-current" />
              </div>
              <p className="text-lg text-gray-300 italic">“{q}”</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 10. BOTTOM CTA (Requested) */}
      <section className="relative z-20 px-4 py-16 text-center sm:px-6 sm:py-24">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl rounded-3xl rahi-panel p-6 sm:p-10 md:p-12"
        >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-6">
                Ready to Start Your Journey?
            </h2>
            <p className="mb-8 text-base text-gray-400 sm:text-lg">
                Your next adventure is just a click away. Let AI handle the details.
            </p>
            
            <Link
              href={plannerEntryHref}
              className="rahi-btn-primary px-8 py-3 text-base sm:px-10 sm:py-4 sm:text-lg"
            >
               Start Planning Now <ArrowRight className="h-5 w-5" />
            </Link>
        </motion.div>
      </section>

      {/* 11. FOOTER */}
      <footer id="community" className="relative z-20 border-t border-white/10 bg-black/40 backdrop-blur-xl py-16 text-center">
        <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6">
          <Globe className="h-8 w-8 text-teal-500 mx-auto animate-pulse" />
          <p className="text-base text-gray-400 sm:text-lg">Trusted by 1000+ student travelers across India 🇮🇳</p>
          
          <div className="pt-8 text-sm text-gray-600 space-y-2">
            <p className="text-teal-400 font-medium tracking-wide">Every traveler is a Rahi.</p>
            <p>© 2026 Rahi.AI — Built with AI • Designed for travelers.</p>
          </div>
        </div>
      </footer>

    </main>
  );
}

// --- HELPER COMPONENTS ---

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-center">
      <h2 className="mb-4 text-2xl font-display font-bold text-white sm:text-3xl md:text-4xl">{title}</h2>
      <div className="h-1 w-20 bg-teal-500 rounded-full mx-auto" />
    </div>
  );
}

type FeatureCardProps = {
  icon: ReactNode;
  title: string;
  desc: string;
  color?: string;
  onClick: () => void;
  eyebrow?: string;
  signal?: string;
  actionLabel?: string;
  reducedMotion?: boolean;
};

function FeatureCard({
  icon,
  title,
  desc,
  color,
  onClick,
  eyebrow,
  signal,
  actionLabel,
  reducedMotion = false,
}: FeatureCardProps) {
  return (
    <motion.div 
      onClick={onClick}
      whileHover={reducedMotion ? undefined : { y: -10 }}
      className={`group relative cursor-pointer rounded-3xl p-6 rahi-card backdrop-blur-sm transition-all duration-300 hover:bg-white/10 sm:p-8 ${color}`}
    >
      {eyebrow && (
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
          {eyebrow}
        </p>
      )}
      <div className="mb-6 p-4 rounded-2xl bg-black/40 w-fit border border-white/5">
        {icon}
      </div>
      <h3 className="mb-3 text-xl font-display font-bold text-white sm:text-2xl">{title}</h3>
      <p className="text-gray-400 leading-relaxed">{desc}</p>
      {signal && (
        <p className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
          {signal}
        </p>
      )}
      {actionLabel && (
        <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-teal-300 group-hover:text-cyan-200">
          <span>{actionLabel}</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      )}
      {/* Glow Effect */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </motion.div>
  );
}
