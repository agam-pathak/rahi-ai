"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import RahiVoiceUI, { speakWithHeart } from "@/components/RahiVoiceUI";
import TripItinerary from "@/components/trips/TripItinerary";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Calendar, IndianRupee, Compass,
  Download, Share2, Trash2, History, CloudSun,
  Plane, Sparkles, MessageSquare, Lock, Unlock,
  ClipboardCheck, PenLine,
  Settings, ShieldCheck, ChevronDown, PanelLeftClose, PanelLeftOpen
} from "lucide-react";
import RahiBackground from "@/components/RahiBackground";
import ThemeToggle from "@/components/ThemeToggle";
import PlannerChatPanel from "./components/PlannerChatPanel";
import VoiceSettingsCard from "./components/VoiceSettingsCard";
import type {
  Activity,
  DayPlan,
  DayStat,
  GeneratePlanOverrides,
  GroupDecision,
  GroupPoll,
  GroupState,
  SavedTrip,
  Trip,
  VoiceSettings,
  WeatherItem,
} from "./types";
import {
  applyBudgetToTrip,
  createLocalId,
  formatCurrency,
  getActivityCoord,
  haversineKm,
  parseActivityIndex,
  parseBudget,
  parseDayNumber,
  parseNumberToken,
} from "./utils";
import { useSyncedSearchParams } from "./hooks/useSyncedSearchParams";
import { usePlannerToast } from "./hooks/usePlannerToast";
import {
  getPlanCapabilities,
  normalizePlanTier,
  type PlanTier,
  type TrialStatus,
} from "@/lib/billing/tier";

const TripMap = dynamic(() => import("@/components/maps/TripMap"), { ssr: false });

const PREMIUM_CHECKLIST = [
  { id: "docs", label: "Government ID + booking copies" },
  { id: "insurance", label: "Travel insurance / emergency cover" },
  { id: "payments", label: "Primary + backup payment method" },
  { id: "offline", label: "Offline maps + tickets downloaded" },
  { id: "medical", label: "Basic meds + essentials packed" },
  { id: "connect", label: "Local SIM / roaming ready" },
];
const ACTIVITY_TYPE_COUNT = 5;
const WEATHER_RISK_PATTERN = /rain|storm|drizzle|shower|thunder|snow|hail/i;
const OUTDOOR_ACTIVITY_TYPES = new Set(["sightseeing", "experience"]);
const PLANNER_STAGE_ORDER = ["build", "optimize", "share"] as const;
type PlannerStage = (typeof PLANNER_STAGE_ORDER)[number];
type IndiaTemplatePreset = {
  id: string;
  title: string;
  destination: string;
  days: number;
  budget: number;
  interests: string;
  vibe: string;
};

type TripRow = {
  id?: string;
  destination?: string;
  days?: string | number;
  budget?: string | number;
  interests?: string;
  result?: Trip | string | null;
  share_code?: string | null;
  is_public?: boolean | null;
  created_at?: string;
  updated_at?: string;
};

const INDIA_TEMPLATE_PRESETS: IndiaTemplatePreset[] = [
  {
    id: "goa-weekend",
    title: "Goa Weekend",
    destination: "Goa",
    days: 3,
    budget: 12000,
    interests: "beach, nightlife, cafes, local food",
    vibe: "beach",
  },
  {
    id: "manali-adventure",
    title: "Manali Adventure",
    destination: "Manali",
    days: 4,
    budget: 15000,
    interests: "mountains, trekking, views, adventure sports",
    vibe: "adventure",
  },
  {
    id: "jaipur-heritage",
    title: "Jaipur Heritage",
    destination: "Jaipur",
    days: 3,
    budget: 11000,
    interests: "forts, culture, shopping, rajasthani food",
    vibe: "cultural",
  },
  {
    id: "rishikesh-retreat",
    title: "Rishikesh Retreat",
    destination: "Rishikesh",
    days: 3,
    budget: 9000,
    interests: "yoga, riverfront, temples, cafes",
    vibe: "chill",
  },
  {
    id: "srinagar-scenic",
    title: "Srinagar Scenic",
    destination: "Srinagar",
    days: 4,
    budget: 14000,
    interests: "lakes, gardens, local cuisine, culture",
    vibe: "nature",
  },
  {
    id: "varanasi-spiritual",
    title: "Varanasi Spiritual",
    destination: "Varanasi",
    days: 2,
    budget: 7000,
    interests: "ghats, temples, local food, evening aarti",
    vibe: "cultural",
  },
];

const TEMPLATE_CARD_STYLES: Record<
  string,
  {
    glow: string;
    accent: string;
    badge: string;
    badgeTone: string;
    chipTone: string;
  }
> = {
  beach: {
    glow: "from-cyan-500/20 via-sky-500/8 to-transparent",
    accent: "text-cyan-200",
    badge: "Weekend pick",
    badgeTone: "bg-cyan-500/15 border-cyan-400/40 text-cyan-200",
    chipTone: "bg-cyan-500/12 text-cyan-100 border-cyan-300/30",
  },
  adventure: {
    glow: "from-orange-500/17 via-amber-500/8 to-transparent",
    accent: "text-amber-200",
    badge: "High energy",
    badgeTone: "bg-amber-500/15 border-amber-400/40 text-amber-200",
    chipTone: "bg-amber-500/12 text-amber-100 border-amber-300/30",
  },
  cultural: {
    glow: "from-fuchsia-500/17 via-violet-500/8 to-transparent",
    accent: "text-fuchsia-200",
    badge: "Culture rich",
    badgeTone: "bg-fuchsia-500/15 border-fuchsia-400/40 text-fuchsia-200",
    chipTone: "bg-fuchsia-500/12 text-fuchsia-100 border-fuchsia-300/30",
  },
  chill: {
    glow: "from-emerald-500/17 via-teal-500/8 to-transparent",
    accent: "text-emerald-200",
    badge: "Easy pace",
    badgeTone: "bg-emerald-500/15 border-emerald-400/40 text-emerald-200",
    chipTone: "bg-emerald-500/12 text-emerald-100 border-emerald-300/30",
  },
  nature: {
    glow: "from-lime-500/15 via-emerald-500/8 to-transparent",
    accent: "text-lime-200",
    badge: "Scenic route",
    badgeTone: "bg-lime-500/15 border-lime-400/40 text-lime-200",
    chipTone: "bg-lime-500/12 text-lime-100 border-lime-300/30",
  },
  default: {
    glow: "from-teal-500/17 via-cyan-500/8 to-transparent",
    accent: "text-teal-200",
    badge: "Popular",
    badgeTone: "bg-teal-500/15 border-teal-400/40 text-teal-200",
    chipTone: "bg-teal-500/12 text-teal-100 border-teal-300/30",
  },
};

export default function PlannerPage() {
  const router = useRouter();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  const searchParams = useSyncedSearchParams();

  // --- STATE ---
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Planner Output State
  const [trip, setTrip] = useState<Trip | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Planner Input State
  const [destination, setDestination] = useState("");
  const [budget, setBudget] = useState("");
  const [durationInput, setDurationInput] = useState(""); // Renamed from 'days' to avoid conflict
  const [interests, setInterests] = useState("");
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [focusView, setFocusView] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Group Coordination
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [groupMemberInput, setGroupMemberInput] = useState("");
  const [groupPolls, setGroupPolls] = useState<GroupPoll[]>([]);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptionsInput, setPollOptionsInput] = useState("");
  const [groupDecisions, setGroupDecisions] = useState<GroupDecision[]>([]);
  const [decisionInput, setDecisionInput] = useState("");
  const [groupLoaded, setGroupLoaded] = useState(false);

  // History & Context
  const [history, setHistory] = useState<SavedTrip[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherItem[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    tts: true,
    earcons: true,
    autoSend: true,
    lang: "en-IN",
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const [listening, setListening] = useState(false);
  const { toast, showToast } = usePlannerToast();
  const [regeneratingDay, setRegeneratingDay] = useState<number | null>(null);
  const [replacingActivityId, setReplacingActivityId] = useState<string | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [planTier, setPlanTier] = useState<PlanTier>("free");
  const [trialStatus, setTrialStatus] = useState<TrialStatus>("none");
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [fixingTrip, setFixingTrip] = useState(false);
  const [mapEnriching, setMapEnriching] = useState(false);
  const [optimizingRoutes, setOptimizingRoutes] = useState(false);
  const [optimizingDay, setOptimizingDay] = useState(false);
  const [dynamicReplanning, setDynamicReplanning] = useState(false);
  const [budgetCopilotRunning, setBudgetCopilotRunning] = useState(false);
  const [lastReplanSummary, setLastReplanSummary] = useState<string | null>(null);
  const [lastBudgetCopilotSummary, setLastBudgetCopilotSummary] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [billingLoading, setBillingLoading] = useState(false);
  const [hasStripeCustomer, setHasStripeCustomer] = useState(false);
  const [upiOpen, setUpiOpen] = useState(false);
  const [upiPaymentId, setUpiPaymentId] = useState<string | null>(null);
  const [upiStatus, setUpiStatus] = useState<"idle" | "pending" | "checking" | "paid" | "error">("idle");
  const [upiError, setUpiError] = useState<string | null>(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistStatus, setWaitlistStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [prepChecklist, setPrepChecklist] = useState<Record<string, boolean>>({});
  const [storyLoading, setStoryLoading] = useState(false);
  const [pdfThemeOverride, setPdfThemeOverride] = useState<string | null>(null);
  const premiumEnabled = process.env.NEXT_PUBLIC_PREMIUM_ENABLED === "true";
  const upiEnabled = process.env.NEXT_PUBLIC_UPI_ENABLED === "true";
  const upiPlanAmount = Number(process.env.NEXT_PUBLIC_UPI_PLAN_AMOUNT_INR ?? "99");
  const e2eBypassAuth =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === "true";
  const upiStorageKey = "rahi_upi_payment_id";
  const geocodeCacheRef = useRef(new Map<string, [number, number]>());
  const geocodeRunRef = useRef<string | null>(null);
  const checklistSaveRef = useRef<number | null>(null);
  const groupSaveRef = useRef<number | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const queuedTripRef = useRef<Trip | null>(null);
  const lastSavedSnapshotRef = useRef<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "saved" | "dirty" | "saving" | "error" | "conflict">("idle");
  const groupStorageKey =
    trip?.id
      ? `rahi-group-${trip.id}`
      : destination.trim()
        ? `rahi-group-${destination.trim().toLowerCase()}`
        : null;
  const historyStorageKey = profileId ? `trip_history:${profileId}` : "trip_history";
  const hiddenHistoryStorageKey = profileId
    ? `trip_history_hidden:${profileId}`
    : "trip_history_hidden";

  const normalizeSavedTripEntry = useCallback(
    (entry: SavedTrip): SavedTrip | null => {
      if (!entry?.tripData || typeof entry.tripData !== "object") return null;
      const destinationValue =
        entry.tripData.destination || entry.destination || "Untitled Trip";
      const budgetInputValue =
        typeof entry.budgetInput === "string"
          ? entry.budgetInput
          : String(entry.tripData.meta?.total_estimated_budget ?? 0);
      const normalizedTrip = applyBudgetToTrip({
        ...entry.tripData,
        destination: destinationValue,
        meta:
          entry.tripData?.meta ?? {
            total_estimated_budget: parseBudget(budgetInputValue) || 0,
          },
        is_public:
          typeof entry.tripData?.is_public === "boolean"
            ? entry.tripData.is_public
            : true,
      });

      const normalizedTime = Number(entry.time);
      return {
        destination: destinationValue,
        daysInput:
          typeof entry.daysInput === "string"
            ? entry.daysInput
            : String(normalizedTrip.days?.length || ""),
        budgetInput: budgetInputValue,
        interestsInput:
          typeof entry.interestsInput === "string"
            ? entry.interestsInput
            : normalizedTrip.meta?.primary_vibes?.join(", ") || "",
        tripData: normalizedTrip,
        time: Number.isFinite(normalizedTime) && normalizedTime > 0 ? normalizedTime : Date.now(),
      };
    },
    []
  );

  const normalizeSavedTripList = useCallback(
    (entries: SavedTrip[]) =>
      entries
        .map((entry) => normalizeSavedTripEntry(entry))
        .filter((entry): entry is SavedTrip => Boolean(entry)),
    [normalizeSavedTripEntry]
  );

  const getHistoryIdentity = useCallback((entry: SavedTrip) => {
    if (entry.tripData?.id) return `id:${entry.tripData.id}`;
    if (entry.tripData?.share_code) return `share:${entry.tripData.share_code}`;
    return `local:${entry.destination}:${entry.daysInput}:${entry.budgetInput}:${entry.time}`;
  }, []);

  const readHiddenHistory = useCallback(() => {
    if (typeof window === "undefined") return new Set<string>();
    const raw = window.localStorage.getItem(hiddenHistoryStorageKey);
    if (!raw) return new Set<string>();
    try {
      const parsed = JSON.parse(raw) as string[];
      return new Set(
        Array.isArray(parsed)
          ? parsed.filter((value): value is string => typeof value === "string")
          : []
      );
    } catch {
      return new Set<string>();
    }
  }, [hiddenHistoryStorageKey]);

  const writeHiddenHistory = useCallback(
    (hidden: Set<string>) => {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(
        hiddenHistoryStorageKey,
        JSON.stringify(Array.from(hidden))
      );
    },
    [hiddenHistoryStorageKey]
  );

  const clearHiddenForTrip = useCallback(
    (value: Trip) => {
      if (!value?.id && !value?.share_code) return;
      const hidden = readHiddenHistory();
      let changed = false;
      if (value.id && hidden.delete(`id:${value.id}`)) {
        changed = true;
      }
      if (value.share_code && hidden.delete(`share:${value.share_code}`)) {
        changed = true;
      }
      if (changed) {
        writeHiddenHistory(hidden);
      }
    },
    [readHiddenHistory, writeHiddenHistory]
  );

  const readLocalHistory = useCallback(() => {
    if (typeof window === "undefined") return [];
    const readEntries = (key: string) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw) as SavedTrip[];
        return normalizeSavedTripList(Array.isArray(parsed) ? parsed : []);
      } catch {
        return [];
      }
    };

    const scopedEntries = readEntries(historyStorageKey);
    if (scopedEntries.length > 0) return scopedEntries;

    if (!profileId) return scopedEntries;

    const legacyEntries = readEntries("trip_history");
    if (legacyEntries.length > 0) {
      window.localStorage.setItem(historyStorageKey, JSON.stringify(legacyEntries));
      return legacyEntries;
    }

    return [];
  }, [historyStorageKey, normalizeSavedTripList, profileId]);

  const writeLocalHistory = useCallback(
    (entries: SavedTrip[]) => {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(historyStorageKey, JSON.stringify(entries));
    },
    [historyStorageKey]
  );

  const mapServerTripToSavedTrip = useCallback(
    (row: TripRow): SavedTrip | null => {
      let result = row?.result;
      if (typeof result === "string") {
        try {
          result = JSON.parse(result);
        } catch {
          return null;
        }
      }

      if (!result || typeof result !== "object") return null;
      const baseTrip = result as Trip;
      const destinationValue =
        baseTrip.destination || (typeof row.destination === "string" ? row.destination : "");
      if (!destinationValue) return null;

      const budgetInputValue = String(
        row.budget ??
          baseTrip.meta?.total_estimated_budget ??
          0
      );
      const normalizedTrip = applyBudgetToTrip({
        ...baseTrip,
        id: typeof row.id === "string" ? row.id : baseTrip.id,
        destination: destinationValue,
        share_code:
          typeof row.share_code === "string" ? row.share_code : baseTrip.share_code,
        is_public:
          typeof row.is_public === "boolean"
            ? row.is_public
            : typeof baseTrip.is_public === "boolean"
              ? baseTrip.is_public
              : true,
        meta:
          baseTrip.meta ?? {
            total_estimated_budget: parseBudget(budgetInputValue) || 0,
          },
      });

      const parsedTime = Date.parse(String(row.updated_at ?? row.created_at ?? ""));
      const mapped: SavedTrip = {
        destination: destinationValue,
        daysInput:
          normalizedTrip.days?.length > 0
            ? String(normalizedTrip.days.length)
            : String(row.days ?? ""),
        budgetInput: budgetInputValue,
        interestsInput:
          typeof row.interests === "string"
            ? row.interests
            : normalizedTrip.meta?.primary_vibes?.join(", ") || "",
        tripData: normalizedTrip,
        time: Number.isFinite(parsedTime) ? parsedTime : Date.now(),
      };
      return normalizeSavedTripEntry(mapped);
    },
    [normalizeSavedTripEntry]
  );

  const mergeHistoryEntries = useCallback(
    (serverEntries: SavedTrip[], localEntries: SavedTrip[]) => {
      const merged: SavedTrip[] = [];
      const seen = new Set<string>();
      const pushUnique = (entry: SavedTrip) => {
        const id = getHistoryIdentity(entry);
        if (seen.has(id)) return;
        seen.add(id);
        merged.push(entry);
      };

      serverEntries.forEach(pushUnique);
      localEntries.forEach(pushUnique);

      return merged.sort((a, b) => b.time - a.time).slice(0, 10);
    },
    [getHistoryIdentity]
  );

  const serializeTripForSync = useCallback((value: Trip | null) => {
    if (!value?.id) return "";
    return JSON.stringify({
      id: value.id,
      days: value.days,
      meta: value.meta,
    });
  }, []);

  const stampTripSyncMeta = useCallback(
    (value: Trip, revision: number, savedAt: string) => ({
      ...value,
      meta: {
        ...value.meta,
        revision,
        last_saved_at: savedAt,
      },
    }),
    []
  );

  const checklistDefaults = useMemo(() => {
    const defaults: Record<string, boolean> = {};
    PREMIUM_CHECKLIST.forEach((item) => {
      defaults[item.id] = false;
    });
    return defaults;
  }, []);

  const mergeChecklist = useCallback(
    (source?: Record<string, boolean>) => {
      return { ...checklistDefaults, ...(source ?? {}) };
    },
    [checklistDefaults]
  );

  const parseApiError = useCallback(async (res: Response) => {
    let message = "Request failed.";
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
      if (typeof data?.details === "string" && data.details.trim()) {
        const compact = data.details.replace(/\s+/g, " ").slice(0, 180);
        message = `${message}: ${compact}`;
      }
    } catch {}

    if (res.status === 429) {
      return "Too many requests. Please wait a minute.";
    }
    if (message === "AI key missing") {
      return "AI key missing. Add GROQ_API_KEY in .env.local.";
    }
    return message;
  }, []);

  const shareTripLink = () => {
    if (!trip?.share_code) {
      showToast("Share link not available yet.");
      return;
    }
    if (trip.is_public === false && !planCapabilities.privateSharing) {
      showToast("Private sharing is Premium-only. Upgrade to share securely.");
      return;
    }
    const url = `${window.location.origin}/trip/${trip.share_code}`;
    navigator.clipboard.writeText(`Check my trip plan made with Rahi.AI ✨\n${url}`);
    showToast(
      trip.is_public === false
        ? "Private link copied. Only invited members can access."
        : "Share link copied ✨"
    );
  };

  const copyTripStory = async (story: string) => {
    if (!story.trim()) {
      showToast("Generate a trip first to create a story.");
      return;
    }
    try {
      await navigator.clipboard.writeText(story);
      showToast("Trip story copied.");
    } catch {
      showToast("Unable to copy story.");
    }
  };

  const refineTripStory = async () => {
    if (!trip?.days?.length) {
      showToast("Generate a trip to craft a story.");
      return;
    }
    if (storyLoading) return;
    setStoryLoading(true);
    try {
      const highlights = trip.days
        .flatMap((day) => day.activities.map((activity) => activity.title))
        .filter(Boolean)
        .slice(0, 5)
        .join(", ");
      const prompt = `Write a premium, 2-3 sentence travel story for a ${trip.days.length}-day trip to ${
        trip.destination
      }. Pace: ${trip.meta?.pace || "balanced"}. Vibes: ${
        trip.meta?.primary_vibes?.join(", ") || "signature"
      }. Highlights: ${highlights || "curated experiences"}. Keep it crisp and elegant.`;
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          history: [],
        }),
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        showToast(msg);
        return;
      }
      const data = await res.json();
      const story = String(data.reply || "").replace(/\s+/g, " ").trim();
      if (!story) {
        showToast("No story returned. Try again.");
        return;
      }
      setTrip((prev) =>
        prev ? { ...prev, meta: { ...prev.meta, signature_story: story } } : prev
      );
      if (trip.id) {
        await persistTripResult({
          ...trip,
          meta: { ...trip.meta, signature_story: story },
        });
      }
      showToast("Story refined.");
    } catch {
      showToast("Unable to refine story right now.");
    } finally {
      setStoryLoading(false);
    }
  };

  const checkUpiStatus = async (paymentIdOverride?: string) => {
    const paymentId = (paymentIdOverride ?? upiPaymentId)?.trim();
    if (!paymentId) {
      setUpiError("Start a UPI payment first.");
      setUpiStatus("error");
      showToast("No UPI payment found. Start payment first.");
      return;
    }

    setUpiStatus("checking");
    setUpiError(null);
    try {
      const res = await fetch(`/api/billing/upi/status?payment_id=${encodeURIComponent(paymentId)}`);
      if (!res.ok) {
        const msg = await parseApiError(res);
        setUpiError(msg || "Unable to verify payment right now.");
        setUpiStatus("error");
        showToast(msg || "Unable to verify payment.");
        return;
      }

      const data = await res.json();
      if (data?.paid) {
        setPlanTier("premium");
        setIsPremium(true);
        setTrialStatus("none");
        setTrialDaysLeft(0);
        setTrialEndsAt(null);
        setHasStripeCustomer(false);
        setUpiStatus("paid");
        showToast("Payment confirmed. Premium unlocked.");
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(upiStorageKey);
        }
        setUpiPaymentId(null);
        setUpiOpen(false);
      } else {
        setUpiStatus("pending");
        showToast("Payment is still pending. Complete payment and check again.");
      }
    } catch {
      setUpiError("Unable to check status right now.");
      setUpiStatus("error");
      showToast("Unable to verify payment.");
    }
  };

  const startUpgrade = async (targetPlan: "premium" | "pro" = "premium") => {
    if (billingLoading) return;
    setBillingLoading(true);
    try {
      if (upiEnabled && targetPlan === "premium") {
        const res = await fetch("/api/billing/upi/initiate", { method: "POST" });
        if (!res.ok) {
          const msg = await parseApiError(res);
          setUpiError(msg || "UPI payment is unavailable right now.");
          setUpiStatus("error");
          showToast(msg || "UPI payment is unavailable.");
          return;
        }

        const data = await res.json();
        const url = typeof data?.url === "string" ? data.url : null;
        const paymentId = typeof data?.paymentId === "string" ? data.paymentId : null;

        if (!url || !paymentId) {
          setUpiError("UPI payment link could not be created.");
          setUpiStatus("error");
          showToast("UPI payment link could not be created.");
          return;
        }

        setUpiOpen(true);
        setUpiError(null);
        setUpiStatus("pending");
        setUpiPaymentId(paymentId);

        if (typeof window !== "undefined") {
          window.localStorage.setItem(upiStorageKey, paymentId);
          const popup = window.open(url, "_blank", "noopener,noreferrer");
          if (!popup) {
            window.location.href = url;
          }
        }

        showToast("Complete payment in the UPI window, then click Check status.");
        return;
      }

      if (upiEnabled && targetPlan === "pro" && !premiumEnabled) {
        showToast("Pro checkout is unavailable right now.");
        return;
      }

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: targetPlan }),
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        showToast(msg || "Billing unavailable.");
        return;
      }
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        showToast("Billing session failed.");
      }
    } catch {
      showToast("Billing unavailable.");
    } finally {
      setBillingLoading(false);
    }
  };

  const manageBilling = async () => {
    if (!hasStripeCustomer) {
      showToast("Paid plan is active. Billing portal is not available for UPI plans.");
      return;
    }
    if (billingLoading) return;
    setBillingLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      if (!res.ok) {
        const msg = await parseApiError(res);
        showToast(msg || "Billing unavailable.");
        return;
      }
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        showToast("Billing portal failed.");
      }
    } catch {
      showToast("Billing unavailable.");
    } finally {
      setBillingLoading(false);
    }
  };

  const submitWaitlist = async () => {
    const email = waitlistEmail.trim();
    if (!email) return;
    setWaitlistStatus("loading");
    try {
      const res = await fetch("/api/billing/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "planner" }),
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        showToast(msg || "Waitlist failed.");
        setWaitlistStatus("error");
        return;
      }
      setWaitlistStatus("success");
    } catch {
      setWaitlistStatus("error");
    }
  };

  const fetchWeather = async (city: string, days: number) => {
    if (!city || !Number.isFinite(days) || days <= 0) return;
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const res = await fetch("/api/ai/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, days }),
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        setWeatherError(msg || "Weather unavailable.");
        showToast(msg || "Weather unavailable.");
        setWeather([]);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setWeather(data);
        setWeatherError(null);
      } else {
        setWeather([]);
        setWeatherError("Weather data unavailable.");
      }
    } catch {
      setWeather([]);
      setWeatherError("Weather request failed.");
    } finally {
      setWeatherLoading(false);
    }
  };

  // --- CONFIG ---
  const mode = searchParams.get("mode");
  const type = searchParams.get("type");

  const MODE_CONFIG: Record<string, { title: string; subtitle: string }> = {
    ai: { title: "AI Trip Planner", subtitle: "Let AI design your perfect journey." },
    budget: { title: "Budget Guardian", subtitle: "Optimize every rupee of your trip." },
    chat: { title: "AI Travel Buddy", subtitle: "Chat with your personal travel assistant." },
  };
  const MODE_ORDER: Array<keyof typeof MODE_CONFIG> = ["ai", "budget", "chat"];
  const STAGE_CONFIG: Record<
    PlannerStage,
    { label: string; hint: string; requiresTrip?: boolean }
  > = {
    build: {
      label: "Build",
      hint: "Set inputs and generate your base plan.",
    },
    optimize: {
      label: "Optimize",
      hint: "Improve route flow, budget, and day sequencing.",
      requiresTrip: true,
    },
    share: {
      label: "Share",
      hint: "Export, share, and coordinate the final itinerary.",
      requiresTrip: true,
    },
  };

  const TYPE_HINTS: Record<string, string> = {
    solo: "Best for solo exploration & flexibility.",
    college: "Fun, affordable & group-friendly trips.",
    family: "Comfort-focused family planning.",
    adventure: "Thrill & activity focused journeys.",
    budget: "Maximum value in minimum spend.",
  };

  const plannerMode = (mode || "ai") as keyof typeof MODE_CONFIG;
  const stage = searchParams.get("stage");
  const requestedStage =
    stage && (PLANNER_STAGE_ORDER as readonly string[]).includes(stage)
      ? (stage as PlannerStage)
      : null;
  const plannerStage: PlannerStage =
    requestedStage && (!STAGE_CONFIG[requestedStage].requiresTrip || Boolean(trip))
      ? requestedStage
      : trip
        ? "optimize"
        : "build";
  const setPlannerStage = (nextStage: PlannerStage) => {
    if (STAGE_CONFIG[nextStage].requiresTrip && !trip) {
      showToast("Generate a trip first to unlock this stage.");
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("stage", nextStage);
    if (plannerMode === "chat") {
      params.set("mode", "ai");
    }
    router.push(`/planner?${params.toString()}`);
  };
  const tripType = (type || "general") as keyof typeof TYPE_HINTS;
  const activeIndiaTemplate = useMemo(
    () =>
      INDIA_TEMPLATE_PRESETS.find((template) => template.id === activeTemplateId) ?? null,
    [activeTemplateId]
  );
  const visibleTemplatePacks = useMemo(() => {
    if (showAllTemplates) return INDIA_TEMPLATE_PRESETS;
    const featured = INDIA_TEMPLATE_PRESETS.slice(0, 3);
    if (!activeIndiaTemplate) return featured;
    if (featured.some((template) => template.id === activeIndiaTemplate.id)) {
      return featured;
    }
    return [activeIndiaTemplate, ...featured.filter((template) => template.id !== activeIndiaTemplate.id)].slice(0, 3);
  }, [showAllTemplates, activeIndiaTemplate]);
  const emptyStateTemplate = activeIndiaTemplate ?? INDIA_TEMPLATE_PRESETS[0];
  const emptyStatePreviewStops = useMemo(() => {
    if (!emptyStateTemplate) return [];
    const tokens = emptyStateTemplate.interests
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return [
      `Arrive and settle in ${emptyStateTemplate.destination}`,
      tokens[0] ? `${tokens[0][0].toUpperCase()}${tokens[0].slice(1)} experience` : "Local experience tour",
      tokens[1] ? `${tokens[1][0].toUpperCase()}${tokens[1].slice(1)} focus` : "Signature evening plan",
    ];
  }, [emptyStateTemplate]);
  const allowPremiumPreview =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_ALLOW_PREMIUM_PREVIEW === "true";
  const premiumPreview = allowPremiumPreview && searchParams.get("premium") === "1";
  const effectiveTier: PlanTier = premiumPreview ? "premium" : planTier;
  const planCapabilities = useMemo(
    () => getPlanCapabilities(effectiveTier),
    [effectiveTier]
  );
  const pdfIsPremium = planCapabilities.premiumPdf;
  const isPro = effectiveTier === "pro";
  const tierBadgeLabel = effectiveTier === "pro"
    ? "PRO"
    : effectiveTier === "premium"
      ? "PREMIUM"
      : effectiveTier === "basic"
        ? "BASIC"
        : "FREE";
  const pdfDebug = searchParams.get("pdfdebug") === "1";
  const premiumEase = [0.16, 1, 0.3, 1] as const;

  // --- EFFECTS ---

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pendingPaymentId = window.localStorage.getItem(upiStorageKey);
    if (!pendingPaymentId) return;
    setUpiPaymentId(pendingPaymentId);
    setUpiStatus("pending");
  }, [upiStorageKey]);

  useEffect(() => {
    if (!upiEnabled) return;
    if (searchParams.get("upi") !== "return") return;
    if (!upiPaymentId) {
      setUpiOpen(true);
      showToast("Returned from UPI. Click Check status to verify payment.");
      return;
    }
    setUpiOpen(true);
    void checkUpiStatus(upiPaymentId);
  }, [searchParams, upiEnabled, upiPaymentId]);

  // 🔐 AUTH GUARD
  useEffect(() => {
    if (e2eBypassAuth) {
      setCheckingAuth(false);
      return;
    }
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.replace("/login");
      else setCheckingAuth(false);
    };
    checkSession();
  }, [router, e2eBypassAuth]);

  // Scroll chat to bottom
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
  }, [chatMessages, typing]);

  // Load history
  useEffect(() => {
    if (checkingAuth) return;

    let cancelled = false;

    const hydrateHistory = async () => {
      const localEntries = readLocalHistory();
      let merged = localEntries;

      try {
        const res = await fetch("/api/trips");
        if (res.ok) {
          const payload = await res.json();
          const serverEntries = Array.isArray(payload)
            ? payload
                .map((row) => mapServerTripToSavedTrip(row as TripRow))
                .filter((entry): entry is SavedTrip => Boolean(entry))
            : [];
          merged = mergeHistoryEntries(serverEntries, localEntries);
        }
      } catch {}

      if (cancelled) return;

      const hidden = readHiddenHistory();
      const visible = merged.filter((entry) => !hidden.has(getHistoryIdentity(entry)));
      setHistory(visible);
      writeLocalHistory(visible);
    };

    void hydrateHistory();

    return () => {
      cancelled = true;
    };
  }, [
    checkingAuth,
    profileId,
    readLocalHistory,
    mapServerTripToSavedTrip,
    mergeHistoryEntries,
    readHiddenHistory,
    getHistoryIdentity,
    writeLocalHistory,
  ]);

  useEffect(() => {
    if (checkingAuth) return;
    fetch("/api/ai/profile")
      .then((res) => res.json())
      .then((data) => {
        setProfileId(typeof data?.id === "string" ? data.id : null);
        const normalizedTier = normalizePlanTier(data?.plan_tier);
        const derivedTier: PlanTier = normalizedTier
          ? normalizedTier
          : Boolean(data?.is_premium)
            ? "premium"
            : data?.trial_active
              ? "basic"
              : "free";
        setPlanTier(derivedTier);
        setIsPremium(derivedTier === "premium" || derivedTier === "pro");
        setHasStripeCustomer(Boolean(data?.stripe_customer_id));
        setTrialStatus(
          data?.trial_status === "active" || data?.trial_status === "expired"
            ? data.trial_status
            : "none"
        );
        setTrialDaysLeft(
          Number.isFinite(Number(data?.trial_days_left))
            ? Math.max(0, Number(data.trial_days_left))
            : 0
        );
        setTrialEndsAt(
          typeof data?.trial_ends_at === "string" && data.trial_ends_at
            ? data.trial_ends_at
            : null
        );
      })
      .catch(() => {
        setProfileId(null);
        setPlanTier("free");
        setTrialStatus("none");
        setTrialDaysLeft(0);
        setTrialEndsAt(null);
        setIsPremium(false);
        setHasStripeCustomer(false);
      });
  }, [checkingAuth]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges && !savingChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [hasUnsavedChanges, savingChanges]);

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
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("rahi-voice-settings", JSON.stringify(voiceSettings));
  }, [voiceSettings]);

  // 🔹 Auto prefill interests
  useEffect(() => {
    if (!type) return;
    if (type === "solo") setInterests("exploration, freedom");
    if (type === "family") setInterests("comfort, kids, safety");
    if (type === "college") setInterests("fun, food, budget");
    if (type === "adventure") setInterests("trekking, thrill");
    if (type === "budget") setInterests("low cost, savings");
  }, [type]);

  const shareUrl = useMemo(() => {
    if (!trip?.share_code) return "";
    if (trip.is_public === false && !planCapabilities.privateSharing) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return origin ? `${origin}/trip/${trip.share_code}` : "";
  }, [trip?.share_code, trip?.is_public, planCapabilities.privateSharing]);

  const mapStops = useMemo(() => {
    if (!trip?.days || !Array.isArray(trip.days)) return [];
    return trip.days.flatMap((day) =>
      day.activities.map((activity, index) => {
        const coord =
          activity.location?.coordinates ||
          (activity.location?.lng !== undefined && activity.location?.lat !== undefined
            ? [activity.location.lng, activity.location.lat]
            : undefined);
        return {
          id: activity.id || `${day.day_number}-${index}`,
          name: activity.location?.name || activity.title,
          day: day.day_number,
          sequence: activity.order_index ?? index,
          cost: Number(activity.estimated_cost) || undefined,
          duration: activity.duration_minutes || undefined,
          coordinates: coord as [number, number] | undefined,
        };
      })
    );
  }, [trip]);

  const pdfMapUrl = useMemo(() => {
    if (!mapboxToken) return "";
    const coord = mapStops.find((stop) => stop.coordinates)?.coordinates;
    if (!coord) return "";
    const [lng, lat] = coord;
    return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${lng},${lat},9,0/900x520?access_token=${mapboxToken}`;
  }, [mapboxToken, mapStops]);

  useEffect(() => {
    if (!pdfIsPremium || !shareUrl) {
      setQrDataUrl("");
      return;
    }

    let cancelled = false;

    const generateQr = async () => {
      try {
        const QRCode = await import("qrcode");
        const dataUrl = await QRCode.toDataURL(shareUrl, {
          width: 240,
          margin: 1,
          color: { dark: "#0f172a", light: "#ffffff" },
        });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setQrDataUrl("");
      }
    };

    generateQr();

    return () => {
      cancelled = true;
    };
  }, [shareUrl, pdfIsPremium]);

  useEffect(() => {
    if (!trip?.days?.length || !mapboxToken) return;
    const missing = trip.days.flatMap((day) =>
      day.activities
        .filter((activity) => {
          const name = activity.location?.name?.trim() || "";
          const lat = Number(activity.location?.lat ?? 0);
          const lng = Number(activity.location?.lng ?? 0);
          const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
          return !!name && name.toLowerCase() !== "unknown" && !hasCoords;
        })
        .map((activity) => ({
          day: day.day_number,
          id: activity.id,
          name: activity.location?.name || activity.title,
        }))
    );

    if (missing.length === 0) return;
    const signature = `${trip.id || "local"}:${missing.map((m) => m.id).join(",")}`;
    if (geocodeRunRef.current === signature) return;
    geocodeRunRef.current = signature;
    let cancelled = false;

    const geocode = async (query: string) => {
      const key = query.toLowerCase();
      const cached = geocodeCacheRef.current.get(key);
      if (cached) return cached;
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query
      )}.json?access_token=${mapboxToken}&limit=1`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const center = data?.features?.[0]?.center;
      if (Array.isArray(center) && center.length === 2) {
        const coord: [number, number] = [center[0], center[1]];
        geocodeCacheRef.current.set(key, coord);
        return coord;
      }
      return null;
    };

    const enrich = async () => {
      setMapEnriching(true);
      const updatedDays = trip.days.map((day) => ({
        ...day,
        activities: day.activities.map((activity) => ({ ...activity, location: { ...activity.location } })),
      }));
      let didUpdate = false;

      for (const item of missing.slice(0, 12)) {
        const query = `${item.name}, ${trip.destination}`;
        const coord = await geocode(query);
        if (!coord || cancelled) continue;
        const day = updatedDays.find((d) => d.day_number === item.day);
        const activity = day?.activities.find((a) => a.id === item.id);
        if (!activity || !activity.location) continue;
        activity.location.lat = coord[1];
        activity.location.lng = coord[0];
        didUpdate = true;
      }

      if (!cancelled && didUpdate) {
        const updatedTrip = { ...trip, days: updatedDays };
        setTrip(updatedTrip);
        updateHistoryEntry(updatedTrip);
        if (updatedTrip.id) {
          await persistTripResult(updatedTrip);
        }
      }

      if (!cancelled) setMapEnriching(false);
    };

    enrich();

    return () => {
      cancelled = true;
    };
  }, [trip, mapboxToken]);

  useEffect(() => {
    if (typeof window === "undefined" || !trip?.id) return;
    const fromTrip = trip.meta?.prep_checklist;
    if (fromTrip && Object.keys(fromTrip).length) {
      const merged = mergeChecklist(fromTrip);
      if (JSON.stringify(merged) !== JSON.stringify(prepChecklist)) {
        setPrepChecklist(merged);
      }
      return;
    }
    const stored = window.localStorage.getItem(`rahi-checklist-${trip.id}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Record<string, boolean>;
        const merged = mergeChecklist(parsed);
        if (JSON.stringify(merged) !== JSON.stringify(prepChecklist)) {
          setPrepChecklist(merged);
        }
        return;
      } catch {}
    }
    setPrepChecklist((prev) => (Object.keys(prev).length ? prev : checklistDefaults));
  }, [trip?.id, trip?.meta?.prep_checklist, checklistDefaults, prepChecklist, mergeChecklist]);

  useEffect(() => {
    if (typeof window === "undefined" || !trip?.id) return;
    if (!Object.keys(prepChecklist).length) return;
    window.localStorage.setItem(
      `rahi-checklist-${trip.id}`,
      JSON.stringify(prepChecklist)
    );
  }, [prepChecklist, trip?.id]);

  useEffect(() => {
    if (!trip?.id || !planCapabilities.signaturePlans) return;
    if (!Object.keys(prepChecklist).length) return;
    const current = trip.meta?.prep_checklist ?? {};
    if (JSON.stringify(current) !== JSON.stringify(prepChecklist)) {
      setTrip((prev) =>
        prev
          ? {
              ...prev,
              meta: { ...prev.meta, prep_checklist: prepChecklist },
            }
          : prev
      );
    }
    if (checklistSaveRef.current) {
      window.clearTimeout(checklistSaveRef.current);
    }
    checklistSaveRef.current = window.setTimeout(() => {
      if (!trip) return;
      persistTripResult({
        ...trip,
        meta: { ...trip.meta, prep_checklist: prepChecklist },
      });
    }, 800);
    return () => {
      if (checklistSaveRef.current) {
        window.clearTimeout(checklistSaveRef.current);
      }
    };
  }, [prepChecklist, trip, planCapabilities.signaturePlans]);

  useEffect(() => {
    if (typeof window === "undefined") {
      setGroupLoaded(false);
      return;
    }

    const fromTrip = trip?.meta?.group_state;
    if (fromTrip) {
      setGroupMembers(Array.isArray(fromTrip.members) ? fromTrip.members : []);
      setGroupPolls(Array.isArray(fromTrip.polls) ? fromTrip.polls : []);
      setGroupDecisions(Array.isArray(fromTrip.decisions) ? fromTrip.decisions : []);
      setGroupLoaded(true);
      return;
    }

    if (!groupStorageKey) {
      setGroupLoaded(false);
      return;
    }

    const stored = window.localStorage.getItem(groupStorageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as {
          members?: string[];
          polls?: GroupPoll[];
          decisions?: GroupDecision[];
        };
        setGroupMembers(Array.isArray(parsed.members) ? parsed.members : []);
        setGroupPolls(Array.isArray(parsed.polls) ? parsed.polls : []);
        setGroupDecisions(Array.isArray(parsed.decisions) ? parsed.decisions : []);
      } catch {
        setGroupMembers([]);
        setGroupPolls([]);
        setGroupDecisions([]);
      }
    } else {
      setGroupMembers([]);
      setGroupPolls([]);
      setGroupDecisions([]);
    }
    setGroupLoaded(true);
  }, [groupStorageKey, trip?.meta?.group_state]);

  useEffect(() => {
    if (typeof window === "undefined" || !groupStorageKey || !groupLoaded) return;
    window.localStorage.setItem(
      groupStorageKey,
      JSON.stringify({
        members: groupMembers,
        polls: groupPolls,
        decisions: groupDecisions,
      })
    );
  }, [groupStorageKey, groupLoaded, groupMembers, groupPolls, groupDecisions]);

  useEffect(() => {
    if (!trip?.id || !groupLoaded) return;
    const groupState: GroupState = {
      members: groupMembers,
      polls: groupPolls,
      decisions: groupDecisions,
    };
    const current = trip.meta?.group_state ?? {};
    if (JSON.stringify(current) !== JSON.stringify(groupState)) {
      setTrip((prev) =>
        prev
          ? {
              ...prev,
              meta: { ...prev.meta, group_state: groupState },
            }
          : prev
      );
    }
    if (groupSaveRef.current) {
      window.clearTimeout(groupSaveRef.current);
    }
    groupSaveRef.current = window.setTimeout(() => {
      if (!trip) return;
      persistTripResult({
        ...trip,
        meta: { ...trip.meta, group_state: groupState },
      });
    }, 800);
    return () => {
      if (groupSaveRef.current) {
        window.clearTimeout(groupSaveRef.current);
      }
    };
  }, [groupMembers, groupPolls, groupDecisions, groupLoaded, trip]);

  useEffect(() => {
    if (!trip?.days?.length) return;
    if (!trip.days.some((day) => day.day_number === selectedDay)) {
      setSelectedDay(trip.days[0].day_number);
    }
  }, [trip?.days, selectedDay]);

  // --- HELPER FUNCTIONS ---

  const downloadPDF = async () => {
    const container = document.getElementById("pdf-export");
    if (!container) return;
    container.classList.add("pdf-render");
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise((resolve) => setTimeout(resolve, 150));

    try {
      const { toPng } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");
      const pages = Array.from(container.querySelectorAll(".pdf-page"));
      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const targets = pages.length ? pages : [container];

      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });

      for (let i = 0; i < targets.length; i++) {
        const dataUrl = await toPng(targets[i] as HTMLElement, {
          cacheBust: true,
          backgroundColor: "#ffffff",
          pixelRatio: 2,
        });
        const img = await loadImage(dataUrl);
        const imgRatio = img.width / img.height;
        const pageRatio = pageWidth / pageHeight;
        let renderWidth = pageWidth;
        let renderHeight = pageHeight;
        if (imgRatio > pageRatio) {
          renderHeight = pageWidth / imgRatio;
        } else {
          renderWidth = pageHeight * imgRatio;
        }
        const offsetX = (pageWidth - renderWidth) / 2;
        const offsetY = (pageHeight - renderHeight) / 2;
        if (i > 0) doc.addPage();
        doc.addImage(dataUrl, "PNG", offsetX, offsetY, renderWidth, renderHeight);
      }

      doc.save(`${destination || "Trip"}_RahiAI_Itinerary.pdf`);
    } finally {
      container.classList.remove("pdf-render");
    }
  };

  const syncFieldsFromChat = (text: string) => {
    const daysMatch = text.match(/day\s*(\d+)/gi);
    if (daysMatch) setDurationInput(String(daysMatch.length));
    
    const destMatch = text.match(/trip to ([a-zA-Z\s]+)/i);
    if (destMatch) {
      const inferredDestination = destMatch[1]
        .trim()
        .replace(/\s+(for|under|with|budget).*/i, "");
      if (inferredDestination) setDestination(inferredDestination);
    }
    
    const budgetMatch = text.match(/₹\s*([\d,]+)/);
    if (budgetMatch) setBudget(budgetMatch[1].replace(/,/g, ""));
    
    if(!interests) setInterests("sightseeing, food, culture");
  };

  const handleCommands = (userMsg: string, aiMsg: string) => {
    const msg = userMsg.toLowerCase();
    if (msg.includes("pdf")) setTimeout(downloadPDF, 500);
    if (msg.includes("budget")) router.push("/planner?mode=budget");
    if (msg.includes("convert") || msg.includes("planner")) syncFieldsFromChat(aiMsg);
  };

  const looksLikeItinerary = (text: string) => {
    return /day\s*1/i.test(text);
  };

  const addGroupMember = () => {
    const name = groupMemberInput.trim();
    if (!name) return;
    setGroupMembers((prev) => {
      if (prev.includes(name)) return prev;
      return [...prev, name];
    });
    setGroupMemberInput("");
  };

  const removeGroupMember = (name: string) => {
    setGroupMembers((prev) => prev.filter((member) => member !== name));
  };

  const addGroupDecision = () => {
    const text = decisionInput.trim();
    if (!text) return;
    const next: GroupDecision = { id: createLocalId(), text, done: false };
    setGroupDecisions((prev) => [next, ...prev]);
    setDecisionInput("");
  };

  const toggleGroupDecision = (id: string) => {
    setGroupDecisions((prev) =>
      prev.map((decision) =>
        decision.id === id
          ? { ...decision, done: !decision.done }
          : decision
      )
    );
  };

  const addGroupPoll = () => {
    const question = pollQuestion.trim();
    if (!question) {
      showToast("Add a poll question.");
      return;
    }
    const options = pollOptionsInput
      .split(",")
      .map((option) => option.trim())
      .filter(Boolean)
      .slice(0, 6);
    if (options.length < 2) {
      showToast("Add at least two poll options.");
      return;
    }
    const poll: GroupPoll = {
      id: createLocalId(),
      question,
      options: options.map((label) => ({
        id: createLocalId(),
        label,
        votes: 0,
      })),
      createdAt: Date.now(),
    };
    setGroupPolls((prev) => [poll, ...prev]);
    setPollQuestion("");
    setPollOptionsInput("");
  };

  const voteGroupPoll = (pollId: string, optionId: string) => {
    setGroupPolls((prev) =>
      prev.map((poll) =>
        poll.id === pollId
          ? {
              ...poll,
              options: poll.options.map((option) =>
                option.id === optionId
                  ? { ...option, votes: option.votes + 1 }
                  : option
              ),
            }
          : poll
      )
    );
  };

  const removeGroupPoll = (pollId: string) => {
    setGroupPolls((prev) => prev.filter((poll) => poll.id !== pollId));
  };

  const deleteTrip = (index: number) => {
    setHistory((prev) => {
      const target = prev[index];
      const updated = prev.filter((_, i) => i !== index);
      writeLocalHistory(updated);
      if (target?.tripData?.id || target?.tripData?.share_code) {
        const hidden = readHiddenHistory();
        hidden.add(getHistoryIdentity(target));
        writeHiddenHistory(hidden);
      }
      return updated;
    });
  };

  const loadHistoryTrip = (entry: SavedTrip) => {
    setDestination(entry.destination);
    setDurationInput(entry.daysInput);
    setBudget(entry.budgetInput);
    setInterests(entry.interestsInput);
    setTrip(entry.tripData);
    void fetchWeather(
      entry.destination,
      Number(entry.daysInput) || entry.tripData.days?.length || 5
    );
  };

  const updateHistoryEntry = useCallback((updatedTrip: Trip) => {
    clearHiddenForTrip(updatedTrip);
    setHistory((prev) => {
      const next = prev.map((entry) => {
        const sameById =
          entry.tripData?.id &&
          updatedTrip.id &&
          entry.tripData.id === updatedTrip.id;
        const sameByShare =
          entry.tripData?.share_code &&
          updatedTrip.share_code &&
          entry.tripData.share_code === updatedTrip.share_code;
        if (
          sameById ||
          sameByShare
        ) {
          return { ...entry, tripData: updatedTrip };
        }
        return entry;
      });
      writeLocalHistory(next);
      return next;
    });
  }, [clearHiddenForTrip, writeLocalHistory]);

  const persistTripResult = useCallback(
    async (updatedTrip: Trip, options?: { reason?: "manual" | "autosave" | "queued" }) => {
      if (!updatedTrip.id) return;
      const snapshot = serializeTripForSync(updatedTrip);
      if (!snapshot) return;
      if (snapshot === lastSavedSnapshotRef.current) {
        setHasUnsavedChanges(false);
        setSyncStatus("saved");
        return;
      }

      if (saveInFlightRef.current) {
        queuedTripRef.current = updatedTrip;
        return;
      }

      const expectedRevision =
        Number.isInteger(updatedTrip.meta?.revision) && Number(updatedTrip.meta.revision) >= 0
          ? Number(updatedTrip.meta.revision)
          : 0;

      saveInFlightRef.current = true;
      setSavingChanges(true);
      setSyncStatus("saving");

      try {
        const res = await fetch("/api/trips/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: updatedTrip.id,
            days: updatedTrip.days,
            meta: updatedTrip.meta,
            expectedRevision,
          }),
        });

        if (res.status === 404) {
          const localFallbackTrip: Trip = {
            ...updatedTrip,
            id: undefined,
            share_code: undefined,
            is_public: true,
            meta: {
              ...updatedTrip.meta,
              revision: 0,
            },
          };
          setTrip((prev) =>
            prev?.id === updatedTrip.id ? localFallbackTrip : prev
          );
          setHistory((prev) => {
            const next = prev.map((entry) => {
              const sameById =
                entry.tripData?.id &&
                updatedTrip.id &&
                entry.tripData.id === updatedTrip.id;
              const sameByShare =
                entry.tripData?.share_code &&
                updatedTrip.share_code &&
                entry.tripData.share_code === updatedTrip.share_code;
              if (!sameById && !sameByShare) return entry;
              return { ...entry, tripData: localFallbackTrip };
            });
            writeLocalHistory(next);
            return next;
          });
          lastSavedSnapshotRef.current = "";
          setHasUnsavedChanges(false);
          setSyncStatus("idle");
          showToast(
            "Cloud trip record not found. This copy is local-only now. Generate again to save online."
          );
          return;
        }

        if (res.status === 409) {
          let payload: any = null;
          try {
            payload = await res.json();
          } catch {}

          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              `rahi-conflict-draft-${updatedTrip.id}`,
              JSON.stringify({
                captured_at: new Date().toISOString(),
                trip: updatedTrip,
              })
            );
          }

          const serverTrip = payload?.serverTrip;
          if (serverTrip && typeof serverTrip === "object") {
            const serverRevision =
              Number.isInteger(payload?.serverRevision) && Number(payload.serverRevision) >= 0
                ? Number(payload.serverRevision)
                : 0;
            const serverSavedAt =
              typeof serverTrip?.meta?.last_saved_at === "string"
                ? serverTrip.meta.last_saved_at
                : new Date().toISOString();
            const nextServerTrip = stampTripSyncMeta(serverTrip as Trip, serverRevision, serverSavedAt);
            setTrip(nextServerTrip);
            updateHistoryEntry(nextServerTrip);
            lastSavedSnapshotRef.current = serializeTripForSync(nextServerTrip);
            setHasUnsavedChanges(false);
          }

          setSyncStatus("conflict");
          showToast(
            "Trip changed in another session. Latest server version loaded. Local draft saved on this device."
          );
          return;
        }

        if (!res.ok) {
          const msg = await parseApiError(res);
          setSyncStatus("error");
          setHasUnsavedChanges(true);
          showToast(options?.reason === "manual" ? msg : `Autosave failed: ${msg}`);
          return;
        }

        let payload: any = null;
        try {
          payload = await res.json();
        } catch {}

        const revision =
          Number.isInteger(payload?.revision) && Number(payload.revision) >= 0
            ? Number(payload.revision)
            : expectedRevision + 1;
        const savedAt =
          typeof payload?.saved_at === "string" ? payload.saved_at : new Date().toISOString();
        const syncedTrip = stampTripSyncMeta(updatedTrip, revision, savedAt);

        lastSavedSnapshotRef.current = serializeTripForSync(syncedTrip);
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(`rahi-unsaved-trip-${updatedTrip.id}`);
          window.localStorage.removeItem(`rahi-conflict-draft-${updatedTrip.id}`);
        }

        setTrip((prev) => {
          if (!prev || prev.id !== updatedTrip.id) return prev;
          const prevSnapshot = serializeTripForSync(prev);
          if (prevSnapshot && prevSnapshot !== snapshot) {
            return stampTripSyncMeta(prev, revision, savedAt);
          }
          return syncedTrip;
        });
        updateHistoryEntry(syncedTrip);
        setHasUnsavedChanges(false);
        setSyncStatus("saved");
      } catch {
        setSyncStatus("error");
        setHasUnsavedChanges(true);
        showToast("Failed to save changes.");
      } finally {
        saveInFlightRef.current = false;
        setSavingChanges(false);
        const queued = queuedTripRef.current;
        queuedTripRef.current = null;
        if (queued) {
          void persistTripResult(queued, { reason: "queued" });
        }
      }
    },
    [
      parseApiError,
      serializeTripForSync,
      showToast,
      stampTripSyncMeta,
      updateHistoryEntry,
      writeLocalHistory,
    ]
  );

  useEffect(() => {
    if (!trip?.id) {
      lastSavedSnapshotRef.current = "";
      setHasUnsavedChanges(false);
      setSyncStatus("idle");
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
      return;
    }

    const snapshot = serializeTripForSync(trip);
    if (!snapshot) return;

    if (!lastSavedSnapshotRef.current) {
      lastSavedSnapshotRef.current = snapshot;
      setHasUnsavedChanges(false);
      setSyncStatus("saved");
      return;
    }

    if (snapshot === lastSavedSnapshotRef.current) {
      setHasUnsavedChanges(false);
      if (!saveInFlightRef.current) {
        setSyncStatus("saved");
      }
      return;
    }

    setHasUnsavedChanges(true);
    if (!saveInFlightRef.current) {
      setSyncStatus("dirty");
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        `rahi-unsaved-trip-${trip.id}`,
        JSON.stringify({
          captured_at: new Date().toISOString(),
          trip,
        })
      );
    }

    if (streaming) return;
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = window.setTimeout(() => {
      void persistTripResult(trip, { reason: "autosave" });
    }, 1200);
  }, [trip, streaming, persistTripResult, serializeTripForSync]);

  // --- CORE GENERATION LOGIC ---
  const generatePlan = async (overrides?: GeneratePlanOverrides) => {
    setStreamError(null);
    const destinationValue = (overrides?.destination ?? destination).trim();
    const durationValue = (overrides?.durationInput ?? durationInput).trim();
    const budgetValue = (overrides?.budget ?? budget).trim();
    const interestsValue = (overrides?.interests ?? interests).trim();
    const daysNum = Number(durationValue);
    const budgetNum = parseBudget(budgetValue);

    if (!destinationValue) {
      setFormError("Please enter a destination.");
      return;
    }
    if (!Number.isFinite(daysNum) || daysNum <= 0) {
      setFormError("Please enter a valid number of days.");
      return;
    }
    if (!Number.isFinite(budgetNum) || budgetNum <= 0) {
      setFormError("Please enter a valid budget.");
      return;
    }
    if (!interestsValue) {
      setFormError("Please add at least one interest.");
      return;
    }

    setLoading(true);
    setFormError(null);
    setStreamError(null);
    // Initialize empty trip structure
    setTrip({
      destination: destinationValue,
      days: [],
      meta: { total_estimated_budget: budgetNum },
      is_public: true
    });
    setWeather([]);
    setStreaming(true);

    try {
      const res = await fetch("/api/ai/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: destinationValue,
          days: daysNum,
          budget: budgetNum,
          interests: interestsValue
        })
      });

      if (!res.ok) {
        const msg = await parseApiError(res);
        setStreamError(msg);
        setStreaming(false);
        setLoading(false);
        return;
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let chunkBuffer = "";

      // Local variables to accumulate data (needed because setState is async)
      let accumulatedDays: DayPlan[] = [];
      let accumulatedMeta = { total_estimated_budget: 0 };
      let shareCode = "";
      let tripId = "";
      let isPublic = true;
      let hadStreamError = false;
      let stopStream = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          chunkBuffer += decoder.decode();
        } else {
          chunkBuffer += decoder.decode(value, { stream: true });
        }

        const lines = chunkBuffer.split("\n");
        chunkBuffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;
          try {
            const msg = JSON.parse(line);

            if (msg.type === "day") {
              accumulatedDays = [...accumulatedDays, msg.payload];
              setTrip(prev => prev ? { ...prev, days: accumulatedDays } : null);
            }

            if (msg.type === "meta") {
              accumulatedMeta = msg.payload;
              setTrip(prev => prev ? { ...prev, meta: accumulatedMeta } : null);
            }

            if (msg.type === "share_code") {
                shareCode = msg.payload;
                setTrip(prev => prev ? { ...prev, share_code: shareCode } : null);
            }

            if (msg.type === "trip_id") {
                tripId = msg.payload;
                setTrip(prev => prev ? { ...prev, id: tripId, is_public: true } : null);
            }

            if (msg.type === "error") {
              setStreamError(msg.message || "AI generation failed.");
              hadStreamError = true;
              stopStream = true;
              break;
            }
          } catch (err) {
            console.error("Error parsing stream line", err);
          }
        }

        if (done) {
          break;
        }
        if (stopStream) {
          await reader.cancel();
          break;
        }
      }

      if (!stopStream) {
        const finalLine = chunkBuffer.trim();
        if (finalLine) {
          try {
            const msg = JSON.parse(finalLine);
            if (msg.type === "day") {
              accumulatedDays = [...accumulatedDays, msg.payload];
              setTrip((prev) => (prev ? { ...prev, days: accumulatedDays } : null));
            }
            if (msg.type === "meta") {
              accumulatedMeta = msg.payload;
              setTrip((prev) => (prev ? { ...prev, meta: accumulatedMeta } : null));
            }
            if (msg.type === "share_code") {
              shareCode = msg.payload;
              setTrip((prev) => (prev ? { ...prev, share_code: shareCode } : null));
            }
            if (msg.type === "trip_id") {
              tripId = msg.payload;
              setTrip((prev) => (prev ? { ...prev, id: tripId, is_public: true } : null));
            }
            if (msg.type === "error") {
              setStreamError(msg.message || "AI generation failed.");
              hadStreamError = true;
            }
          } catch (err) {
            console.error("Error parsing final stream line", err);
          }
        }
      }

      setStreaming(false);
      if (hadStreamError) return;

      // Construct Final Object for History
      const finalTrip: Trip = applyBudgetToTrip({
        id: tripId || undefined,
        destination: destinationValue,
        days: accumulatedDays,
        meta: accumulatedMeta,
        share_code: shareCode,
        is_public: isPublic
      });

      if (finalTrip.days.length === 0) {
        setStreamError("No days were generated. Please try again.");
        return;
      }

      setTrip(finalTrip);
      if (plannerStage === "build") {
        const params = new URLSearchParams(searchParams.toString());
        params.set("stage", "optimize");
        router.replace(`/planner?${params.toString()}`);
      }

      const savedEntry: SavedTrip = {
        destination: destinationValue,
        daysInput: durationValue,
        budgetInput: budgetValue,
        interestsInput: interestsValue,
        tripData: finalTrip,
        time: Date.now(),
      };

      // Update Local History
      clearHiddenForTrip(finalTrip);
      setHistory((prev) => {
        const updated = [savedEntry, ...prev].slice(0, 10);
        writeLocalHistory(updated);
        return updated;
      });

      await fetchWeather(destinationValue, Number(durationValue));

    } catch (e) {
      console.error(e);
      setStreamError("❌ AI generation failed. Please try again.");
      setStreaming(false);
    } finally {
      setLoading(false);
    }
  };

  const applyIndiaTemplate = (template: IndiaTemplatePreset, autoGenerate = false) => {
    if (autoGenerate && (loading || streaming)) {
      showToast("Planning is already running.");
      return;
    }
    const nextDuration = String(template.days);
    const nextBudget = String(template.budget);
    setDestination(template.destination);
    setDurationInput(nextDuration);
    setBudget(nextBudget);
    setInterests(template.interests);
    setActiveTemplateId(template.id);
    setFormError(null);
    showToast(`${template.title} template loaded.`);

    if (autoGenerate) {
      void generatePlan({
        destination: template.destination,
        durationInput: nextDuration,
        budget: nextBudget,
        interests: template.interests,
      });
    }
  };

  const toggleTripVisibility = async (nextVisibility?: boolean) => {
    if (!trip?.id) {
      showToast("Trip is not saved yet.");
      return;
    }

    const currentVisibility = trip.is_public ?? true;
    const desiredVisibility =
      typeof nextVisibility === "boolean" ? nextVisibility : !currentVisibility;
    if (currentVisibility === desiredVisibility) {
      showToast(desiredVisibility ? "Trip is already public." : "Trip is already private.");
      return;
    }
    setToggleLoading(true);
    try {
      const res = await fetch("/api/trips/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: trip.id, is_public: desiredVisibility }),
      });

      if (!res.ok) {
        const msg = await parseApiError(res);
        showToast(msg);
        return;
      }

      const updatedTrip = { ...trip, is_public: desiredVisibility };
      setTrip(updatedTrip);
      updateHistoryEntry(updatedTrip);
      showToast(desiredVisibility ? "Trip is now public." : "Trip is now private.");
    } catch {
      showToast("Failed to update visibility.");
    } finally {
      setToggleLoading(false);
    }
  };

  const regenerateDay = async (dayNumber: number) => {
    if (!trip) return;
    if (regeneratingDay) return;

    setStreamError(null);
    setRegeneratingDay(dayNumber);

    try {
      const avoidTitles = trip.days
        .filter((d) => d.day_number !== dayNumber)
        .flatMap((d) => d.activities.map((a) => a.title))
        .filter(Boolean);
      const effectiveBudget = Number.isFinite(trip.meta?.total_estimated_budget)
        ? Number(trip.meta.total_estimated_budget)
        : parseBudget(budget);
      const effectiveInterests =
        interests.trim() ||
        trip.meta?.primary_vibes?.join(", ") ||
        "sightseeing, food, culture";

      const res = await fetch("/api/ai/day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: trip.destination || destination,
          days: trip.days.length || Number(durationInput),
          day_number: dayNumber,
          budget: effectiveBudget,
          interests: effectiveInterests,
          avoid_titles: avoidTitles,
        }),
      });

      if (!res.ok) {
        const msg = await parseApiError(res);
        showToast(msg);
        return;
      }

      const newDay = await res.json();
      const updatedTrip = applyBudgetToTrip({
        ...trip,
        days: trip.days.map((day) =>
          day.day_number === dayNumber ? newDay : day
        ),
      });
      setTrip(updatedTrip);
      updateHistoryEntry(updatedTrip);
      await persistTripResult(updatedTrip);
      showToast(`Day ${dayNumber} regenerated.`);
    } catch {
      showToast("Failed to regenerate day.");
    } finally {
      setRegeneratingDay(null);
    }
  };

  const autoFixTrip = async () => {
    if (!tripHealth?.fixableDays?.length) {
      showToast("No fixes needed right now.");
      return;
    }
    if (fixingTrip || regeneratingDay || loading || streaming) return;
    setFixingTrip(true);
    try {
      for (const day of tripHealth.fixableDays) {
        await regenerateDay(day);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      showToast("Auto-fix complete.");
    } catch {
      showToast("Auto-fix failed.");
    } finally {
      setFixingTrip(false);
    }
  };

  const getTripSpend = useCallback((sourceTrip: Trip) => {
    return sourceTrip.days.reduce((sum, day) => {
      const daySpend = day.activities.reduce(
        (acc, activity) => acc + (Number(activity.estimated_cost) || 0),
        0
      );
      return sum + daySpend;
    }, 0);
  }, []);

  const normalizeActivityOrder = useCallback(
    (activities: Activity[]) =>
      activities.map((activity, index) => ({
        ...activity,
        order_index: index,
      })),
    []
  );

  const orderActivitiesByDistance = useCallback(
    (activities: Activity[]) => {
      const sorted = [...activities].sort(
        (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
      );
      const withCoords = sorted.filter((activity) => getActivityCoord(activity));
      if (withCoords.length < 2) {
        return { activities: sorted, changed: false };
      }

      const withoutCoords = sorted.filter((activity) => !getActivityCoord(activity));
      const remaining = [...withCoords];
      const ordered: Activity[] = [];
      ordered.push(remaining.shift()!);

      while (remaining.length > 0) {
        const last = ordered[ordered.length - 1];
        const lastCoord = getActivityCoord(last);
        if (!lastCoord) {
          ordered.push(...remaining);
          break;
        }

        let bestIndex = 0;
        let bestDist = Infinity;
        remaining.forEach((candidate, index) => {
          const coord = getActivityCoord(candidate);
          if (!coord) return;
          const dist = haversineKm(lastCoord, coord);
          if (dist < bestDist) {
            bestDist = dist;
            bestIndex = index;
          }
        });
        const [next] = remaining.splice(bestIndex, 1);
        ordered.push(next);
      }

      const merged = [...ordered, ...withoutCoords];
      const changed = merged.some((activity, index) => activity.id !== sorted[index]?.id);
      return { activities: normalizeActivityOrder(merged), changed };
    },
    [normalizeActivityOrder]
  );

  const applyWeatherAwareOrder = useCallback(
    (activities: Activity[], weatherText: string) => {
      const sorted = [...activities].sort(
        (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
      );
      if (!WEATHER_RISK_PATTERN.test(weatherText)) {
        return { activities: sorted, changed: false };
      }

      const indoor = sorted.filter(
        (activity) =>
          !OUTDOOR_ACTIVITY_TYPES.has(String(activity.type ?? "").toLowerCase())
      );
      const outdoor = sorted.filter((activity) =>
        OUTDOOR_ACTIVITY_TYPES.has(String(activity.type ?? "").toLowerCase())
      );
      const merged = [...indoor, ...outdoor];
      const changed = merged.some((activity, index) => activity.id !== sorted[index]?.id);
      return { activities: normalizeActivityOrder(merged), changed };
    },
    [normalizeActivityOrder]
  );

  const requestActivityReplacement = useCallback(
    async ({
      sourceTrip,
      dayNumber,
      activityId,
      maxCost,
    }: {
      sourceTrip: Trip;
      dayNumber: number;
      activityId: string;
      maxCost?: number;
    }) => {
      const targetDay = sourceTrip.days.find((day) => day.day_number === dayNumber);
      if (!targetDay) return null;
      const targetActivity = targetDay.activities.find((act) => act.id === activityId);
      if (!targetActivity) return null;

      const avoidTitles = targetDay.activities
        .filter((a) => a.id !== activityId)
        .map((a) => a.title)
        .filter(Boolean);
      const effectiveBudget = Number.isFinite(sourceTrip.meta?.total_estimated_budget)
        ? Number(sourceTrip.meta.total_estimated_budget)
        : parseBudget(budget);
      const effectiveInterests =
        interests.trim() ||
        sourceTrip.meta?.primary_vibes?.join(", ") ||
        "sightseeing, food, culture";
      const maxCostHint =
        Number.isFinite(maxCost) && Number(maxCost) > 0
          ? Math.round(Number(maxCost))
          : undefined;

      const res = await fetch("/api/ai/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: sourceTrip.destination || destination,
          day_number: dayNumber,
          budget: effectiveBudget,
          interests: effectiveInterests,
          current_title: targetActivity.title,
          order_index: targetActivity.order_index,
          avoid_titles: avoidTitles,
          ...(maxCostHint ? { max_cost: maxCostHint } : {}),
        }),
      });

      if (!res.ok) {
        const msg = await parseApiError(res);
        throw new Error(msg);
      }

      const newActivity = await res.json();
      const updatedTrip = applyBudgetToTrip({
        ...sourceTrip,
        days: sourceTrip.days.map((day) => {
          if (day.day_number !== dayNumber) return day;
          return {
            ...day,
            activities: day.activities.map((act) =>
              act.id === activityId
                ? {
                    ...newActivity,
                    id: newActivity?.id || createLocalId(),
                    order_index: Number.isFinite(newActivity?.order_index)
                      ? Number(newActivity.order_index)
                      : act.order_index,
                  }
                : act
            ),
          };
        }),
      });
      return updatedTrip;
    },
    [budget, destination, interests, parseApiError]
  );

  type ReplaceActivityOptions = {
    maxCost?: number;
    silent?: boolean;
    persist?: boolean;
  };

  const replaceActivity = async (
    dayNumber: number,
    activityId: string,
    options?: ReplaceActivityOptions
  ) => {
    if (!trip) return null;
    if (replacingActivityId) return null;

    setStreamError(null);
    setReplacingActivityId(activityId);

    try {
      const updatedTrip = await requestActivityReplacement({
        sourceTrip: trip,
        dayNumber,
        activityId,
        maxCost: options?.maxCost,
      });
      if (!updatedTrip) {
        if (!options?.silent) showToast("Activity not found.");
        return null;
      }
      setTrip(updatedTrip);
      updateHistoryEntry(updatedTrip);
      if (options?.persist !== false) {
        await persistTripResult(updatedTrip);
      }
      if (!options?.silent) {
        showToast("Activity replaced.");
      }
      return updatedTrip;
    } catch (error: any) {
      if (!options?.silent) {
        showToast(error?.message || "Failed to replace activity.");
      }
      return null;
    } finally {
      setReplacingActivityId(null);
    }
  };

  const reorderActivities = async (dayNumber: number, fromIndex: number, toIndex: number) => {
    if (!trip) return;
    if (fromIndex === toIndex) return;

    const targetDay = trip.days.find((day) => day.day_number === dayNumber);
    if (!targetDay) return;

    const sorted = [...targetDay.activities].sort(
      (a, b) => a.order_index - b.order_index
    );
    if (fromIndex < 0 || fromIndex >= sorted.length) return;
    if (toIndex < 0 || toIndex >= sorted.length) return;

    const [moved] = sorted.splice(fromIndex, 1);
    sorted.splice(toIndex, 0, moved);
    const normalized = sorted.map((activity, index) => ({
      ...activity,
      order_index: index,
    }));

    const updatedTrip = applyBudgetToTrip({
      ...trip,
      days: trip.days.map((day) =>
        day.day_number === dayNumber
          ? { ...day, activities: normalized }
          : day
      ),
    });

    setTrip(updatedTrip);
    updateHistoryEntry(updatedTrip);
    await persistTripResult(updatedTrip);
    showToast("Activity reordered.");
  };

  const optimizeTripRoutes = async () => {
    if (!trip || optimizingRoutes) return;
    if (!planCapabilities.routeOptimization) {
      showToast("Route optimization is available on Premium and Pro.");
      return;
    }
    if (!premiumInsights?.canOptimize) {
      showToast("Not enough location data to optimize routes.");
      return;
    }
    setOptimizingRoutes(true);
    try {
      let optimizedDays = 0;
      const updatedDays = trip.days.map((day) => {
        const optimized = orderActivitiesByDistance(day.activities);
        if (!optimized.changed) return day;
        optimizedDays += 1;
        return { ...day, activities: optimized.activities };
      });
      if (optimizedDays === 0) {
        showToast("Not enough location data to optimize routes.");
        return;
      }
      const updatedTrip = applyBudgetToTrip({
        ...trip,
        days: updatedDays,
      });
      setTrip(updatedTrip);
      updateHistoryEntry(updatedTrip);
      await persistTripResult(updatedTrip);
      showToast(
        optimizedDays > 1
          ? `Routes optimized across ${optimizedDays} days.`
          : "Routes optimized for shorter travel."
      );
    } catch {
      showToast("Route optimization failed.");
    } finally {
      setOptimizingRoutes(false);
    }
  };

  const optimizeDayPlan = async (dayNumber: number) => {
    if (!trip || optimizingDay) return;
    if (!planCapabilities.dayOptimization) {
      showToast("Day optimization is a Pro feature.");
      return;
    }
    const day = trip.days.find((entry) => entry.day_number === dayNumber);
    if (!day) return;

    setOptimizingDay(true);
    try {
      const weatherText =
        weather?.[dayNumber - 1]?.weather?.[0]?.description?.toLowerCase() ?? "";
      const distanceOptimized = orderActivitiesByDistance(day.activities);
      const baseActivities = distanceOptimized.changed
        ? distanceOptimized.activities
        : [...day.activities].sort(
            (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
          );
      const weatherOptimized = applyWeatherAwareOrder(baseActivities, weatherText);
      const merged = weatherOptimized.changed
        ? weatherOptimized.activities
        : baseActivities;
      const didOptimize = distanceOptimized.changed || weatherOptimized.changed;
      const isRiskWeather = WEATHER_RISK_PATTERN.test(weatherText);

      if (!didOptimize) {
        showToast("Not enough data to optimize this day.");
        return;
      }

      const updatedTrip = applyBudgetToTrip({
        ...trip,
        days: trip.days.map((entry) =>
          entry.day_number === dayNumber
            ? { ...entry, activities: normalizeActivityOrder(merged) }
            : entry
        ),
      });

      setTrip(updatedTrip);
      updateHistoryEntry(updatedTrip);
      await persistTripResult(updatedTrip);
      showToast(
        isRiskWeather ? "Day optimized for weather + distance." : "Day optimized."
      );
    } catch {
      showToast("Day optimization failed.");
    } finally {
      setOptimizingDay(false);
    }
  };

  const runBudgetTrim = useCallback(
    async (sourceTrip: Trip, maxSwaps = 2) => {
      const targetBudget = Number.isFinite(sourceTrip.meta?.total_estimated_budget)
        ? Number(sourceTrip.meta.total_estimated_budget)
        : parseBudget(budget);
      if (!Number.isFinite(targetBudget) || targetBudget <= 0) {
        return { trip: sourceTrip, swaps: 0 };
      }

      let workingTrip = sourceTrip;
      let spend = getTripSpend(workingTrip);
      let swaps = 0;

      while (swaps < maxSwaps && spend > targetBudget * 1.02) {
        const candidates = workingTrip.days
          .flatMap((day) =>
            day.activities.map((activity) => ({
              dayNumber: day.day_number,
              activity,
              cost: Number(activity.estimated_cost) || 0,
            }))
          )
          .sort((a, b) => b.cost - a.cost);

        const candidate = candidates[0];
        if (!candidate?.activity?.id || candidate.cost <= 0) break;

        const maxCostHint = Math.max(
          200,
          Math.round(
            Math.min(
              candidate.cost * 0.72,
              (targetBudget / Math.max(workingTrip.days.length, 1)) * 0.9
            )
          )
        );

        try {
          const nextTrip = await requestActivityReplacement({
            sourceTrip: workingTrip,
            dayNumber: candidate.dayNumber,
            activityId: candidate.activity.id,
            maxCost: maxCostHint,
          });
          if (!nextTrip) break;
          workingTrip = nextTrip;
          spend = getTripSpend(workingTrip);
          swaps += 1;
        } catch {
          break;
        }
      }

      return { trip: workingTrip, swaps };
    },
    [budget, getTripSpend, requestActivityReplacement]
  );

  const runBudgetCopilot = async () => {
    if (!trip || budgetCopilotRunning) return;
    if (!planCapabilities.premiumInsights) {
      showToast("Budget Copilot is available on Premium and Pro.");
      return;
    }

    const targetBudget = Number.isFinite(displayBudget)
      ? Number(displayBudget)
      : parseBudget(budget);
    if (!Number.isFinite(targetBudget) || targetBudget <= 0) {
      showToast("Set a target budget to use Budget Copilot.");
      return;
    }

    const currentSpend = getTripSpend(trip);
    if (currentSpend <= targetBudget * 1.02) {
      setLastBudgetCopilotSummary("Spend is already aligned with your budget.");
      showToast("Budget already on track.");
      return;
    }

    if (!planCapabilities.activitySwap) {
      showToast("Auto-trim is available on Pro.");
      return;
    }

    setBudgetCopilotRunning(true);
    setLastBudgetCopilotSummary(null);
    try {
      const { trip: trimmedTrip, swaps } = await runBudgetTrim(trip, 3);
      if (!swaps) {
        showToast("Budget Copilot could not find cheaper swaps right now.");
        return;
      }

      const savings = Math.max(0, currentSpend - getTripSpend(trimmedTrip));
      const summary = `Auto-trimmed ${swaps} pricey stop${
        swaps > 1 ? "s" : ""
      } and saved about ₹${formatCurrency(Math.round(savings))}.`;

      setTrip(trimmedTrip);
      updateHistoryEntry(trimmedTrip);
      await persistTripResult(trimmedTrip);
      setLastBudgetCopilotSummary(summary);
      showToast("Budget Copilot complete.");
    } catch {
      showToast("Budget Copilot failed.");
    } finally {
      setBudgetCopilotRunning(false);
    }
  };

  const runDynamicReplan = async () => {
    if (!trip || dynamicReplanning) return;
    if (!isPro) {
      showToast("Dynamic Replan is a Pro concierge feature.");
      return;
    }

    setDynamicReplanning(true);
    setLastReplanSummary(null);
    try {
      let workingTrip = trip;
      const actions: string[] = [];

      if (planCapabilities.routeOptimization) {
        let routeChanges = 0;
        const nextDays = workingTrip.days.map((day) => {
          const optimized = orderActivitiesByDistance(day.activities);
          if (!optimized.changed) return day;
          routeChanges += 1;
          return { ...day, activities: optimized.activities };
        });
        if (routeChanges > 0) {
          workingTrip = applyBudgetToTrip({ ...workingTrip, days: nextDays });
          actions.push(
            `Routes optimized on ${routeChanges} day${routeChanges > 1 ? "s" : ""}.`
          );
        }
      }

      let weatherChanges = 0;
      const weatherDays = workingTrip.days.map((day) => {
        const weatherText =
          weather?.[day.day_number - 1]?.weather?.[0]?.description?.toLowerCase() ??
          "";
        return { day, weatherText };
      });
      const weatherAdjustedDays = weatherDays.map(({ day, weatherText }) => {
        const weatherOptimized = applyWeatherAwareOrder(day.activities, weatherText);
        if (!weatherOptimized.changed) return day;
        weatherChanges += 1;
        return { ...day, activities: weatherOptimized.activities };
      });
      if (weatherChanges > 0) {
        workingTrip = applyBudgetToTrip({
          ...workingTrip,
          days: weatherAdjustedDays,
        });
        actions.push(
          `Rain-aware ordering applied to ${weatherChanges} day${
            weatherChanges > 1 ? "s" : ""
          }.`
        );
      }

      const targetBudget = Number.isFinite(displayBudget)
        ? Number(displayBudget)
        : parseBudget(budget);
      if (
        Number.isFinite(targetBudget) &&
        targetBudget > 0 &&
        getTripSpend(workingTrip) > targetBudget * 1.02
      ) {
        const { trip: trimmedTrip, swaps } = await runBudgetTrim(workingTrip, 2);
        if (swaps > 0) {
          workingTrip = trimmedTrip;
          actions.push(
            `Budget Copilot swapped ${swaps} expensive stop${
              swaps > 1 ? "s" : ""
            }.`
          );
        }
      }

      if (!actions.length) {
        setLastReplanSummary("No major adjustments needed for current weather and spend.");
        showToast("Plan already looks optimized.");
        return;
      }

      const summary = actions.join(" ");
      setTrip(workingTrip);
      updateHistoryEntry(workingTrip);
      await persistTripResult(workingTrip);
      setLastReplanSummary(summary);
      showToast("Dynamic Replan complete.");
    } catch {
      showToast("Dynamic Replan failed.");
    } finally {
      setDynamicReplanning(false);
    }
  };

  const swapExpensiveActivity = async () => {
    if (!trip || replacingActivityId) return;
    if (!planCapabilities.activitySwap) {
      showToast("Activity swap assistant is a Pro feature.");
      return;
    }
    const expensive = premiumInsights?.expensiveActivity;
    if (!expensive?.activity?.id) {
      showToast("No pricey activity to swap yet.");
      return;
    }
    await replaceActivity(expensive.day, expensive.activity.id);
  };

  const applyVoiceInputs = (text: string) => {
    let updated = false;

    const daysMatch = text.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(day|days)\b/i);
    if (daysMatch) {
      const days = parseNumberToken(daysMatch[1]);
      if (days) {
        setDurationInput(String(days));
        updated = true;
      }
    }

    const budgetMatch =
      text.match(/(?:₹|rs\.?|rupees?|budget|under)\s*([0-9,.k]+)/i) ||
      text.match(/(\d+(?:\.\d+)?)\s*k\b/i);
    if (budgetMatch) {
      const raw = budgetMatch[1].toLowerCase();
      const hasK = raw.includes("k");
      const numericBase = Number(raw.replace(/k|,/g, ""));
      const numeric = hasK ? Math.round(numericBase * 1000) : Math.round(numericBase);
      if (Number.isFinite(numeric)) {
        setBudget(String(numeric));
        updated = true;
      }
    }

    const destinationMatch =
      text.match(/(?:to|for|in|going to|visit|visiting)\s+([a-zA-Z\s]+?)(?:\s+(?:for|under|budget|with|days?|day)\b|$)/i) ||
      text.match(/destination\s+(?:is|to|=)\s*([a-zA-Z\s]+)/i);
    if (destinationMatch) {
      setDestination(destinationMatch[1].trim());
      updated = true;
    }

    const interestMatch =
      text.match(/(?:interests?|vibes?|focus)\s*(?:are|is|like|on)?\s*([a-zA-Z,\s]+)/i) ||
      text.match(/(?:interested in|love|prefer)\s+([a-zA-Z,\s]+)/i);
    if (interestMatch) {
      setInterests(interestMatch[1].trim());
      updated = true;
    }

    return updated;
  };

  const buildConciergeBrief = (dayNumber: number) => {
    const day = trip?.days?.find((entry) => entry.day_number === dayNumber);
    if (!day) return null;
    const ordered = [...day.activities].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
    );
    const highlights = ordered
      .slice(0, 3)
      .map((activity) => activity.title)
      .filter(Boolean)
      .join(", ");
    const spend = ordered.reduce(
      (sum, activity) => sum + (Number(activity.estimated_cost) || 0),
      0
    );
    const weatherText =
      weather?.[dayNumber - 1]?.weather?.[0]?.description?.toLowerCase() ?? "";
    const weatherHint = weatherText
      ? WEATHER_RISK_PATTERN.test(weatherText)
        ? "Expect wet weather, so keep indoor stops first."
        : `Weather looks ${weatherText}.`
      : "Weather data is not available yet.";

    return `Day ${dayNumber} has ${ordered.length} stops. Highlights: ${
      highlights || "curated local experiences"
    }. Estimated spend is rupees ${Math.round(spend)}. ${weatherHint}`;
  };

  const handleVoiceCommand = (text: string) => {
    const lower = text.toLowerCase();

    if (/stop speaking|be quiet|silence|stop voice/.test(lower)) {
      if (typeof window !== "undefined") {
        window.speechSynthesis.cancel();
      }
      setVoiceStatus("idle");
      showToast("Voice playback stopped.");
      return true;
    }

    if (
      /(turn|switch)\s+(off|disable|mute)\s+(voice|speech|tts)/.test(lower) ||
      /mute\s+(voice|assistant)/.test(lower)
    ) {
      setVoiceSettings((prev) => ({ ...prev, tts: false }));
      if (typeof window !== "undefined") {
        window.speechSynthesis.cancel();
      }
      setVoiceStatus("idle");
      showToast("Voice replies turned off.");
      return true;
    }

    if (
      /(turn|switch)\s+(on|enable)\s+(voice|speech|tts)/.test(lower) ||
      /unmute\s+(voice|assistant)/.test(lower)
    ) {
      setVoiceSettings((prev) => ({ ...prev, tts: true }));
      showToast("Voice replies turned on.");
      return true;
    }

    if (
      /(turn|switch)\s+(on|enable)\s+auto\s*send/.test(lower) ||
      /auto\s*send\s+(on|enable)/.test(lower)
    ) {
      setVoiceSettings((prev) => ({ ...prev, autoSend: true }));
      showToast("Auto send enabled.");
      return true;
    }

    if (
      /(turn|switch)\s+(off|disable)\s+auto\s*send/.test(lower) ||
      /auto\s*send\s+(off|disable)/.test(lower)
    ) {
      setVoiceSettings((prev) => ({ ...prev, autoSend: false }));
      showToast("Auto send disabled.");
      return true;
    }

    if (/switch.*hindi|hindi language|language hindi/.test(lower)) {
      setVoiceSettings((prev) => ({ ...prev, lang: "hi-IN" }));
      showToast("Voice language set to Hindi.");
      return true;
    }

    if (/switch.*english|english language|language english/.test(lower)) {
      setVoiceSettings((prev) => ({ ...prev, lang: "en-IN" }));
      showToast("Voice language set to English.");
      return true;
    }

    if (/download\s+(the\s+)?(pdf|itinerary|plan)|export\s+pdf|save\s+pdf/.test(lower)) {
      downloadPDF();
      showToast("Downloading PDF.");
      return true;
    }

    if (/share\s+link|copy\s+link|share\s+trip/.test(lower)) {
      shareTripLink();
      return true;
    }

    if (/make\s+.*public|set\s+.*public|go\s+public/.test(lower)) {
      toggleTripVisibility(true);
      return true;
    }

    if (/make\s+.*private|set\s+.*private|go\s+private/.test(lower)) {
      toggleTripVisibility(false);
      return true;
    }

    if (/(dynamic|smart)\s*(replan|replanning)|replan\s+trip|weather\s+replan/.test(lower)) {
      if (!isPro) {
        showToast("Voice Concierge actions require Pro.");
        return true;
      }
      void runDynamicReplan();
      showToast("Running Dynamic Replan.");
      return true;
    }

    if (/budget\s+copilot|auto\s*trim|trim\s+budget|reduce\s+spend/.test(lower)) {
      if (!isPro) {
        showToast("Voice Concierge actions require Pro.");
        return true;
      }
      void runBudgetCopilot();
      showToast("Running Budget Copilot.");
      return true;
    }

    if (/optimi[sz]e\s+routes?|shortest\s+route|route\s+optimization/.test(lower)) {
      if (!isPro) {
        showToast("Voice Concierge actions require Pro.");
        return true;
      }
      void optimizeTripRoutes();
      showToast("Optimizing routes.");
      return true;
    }

    const optimizeDayVoiceMatch = lower.match(
      /optimi[sz]e\s+day\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i
    );
    if (optimizeDayVoiceMatch) {
      if (!isPro) {
        showToast("Voice Concierge actions require Pro.");
        return true;
      }
      const dayNumber = parseNumberToken(optimizeDayVoiceMatch[1]);
      if (!dayNumber) {
        showToast("Please specify a valid day number.");
        return true;
      }
      void optimizeDayPlan(dayNumber);
      showToast(`Optimizing day ${dayNumber}.`);
      return true;
    }

    if (/concierge\s+brief|trip\s+brief|day\s+brief|read\s+day|day\s+summary/.test(lower)) {
      if (!isPro) {
        showToast("Voice Concierge actions require Pro.");
        return true;
      }
      const requestedDay = parseDayNumber(lower) ?? selectedDay;
      const brief = buildConciergeBrief(requestedDay);
      if (!brief) {
        showToast("No day summary available yet.");
        return true;
      }
      setChatMessages((prev) => [...prev, `Rahi.AI: ${brief}`]);
      if (voiceSettings.tts) {
        speakWithHeart(brief, voiceSettings.lang);
      }
      showToast(`Shared concierge brief for day ${requestedDay}.`);
      return true;
    }

    const regenMatch =
      lower.match(/(regenerate|redo|refresh|replan)\s+day\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i) ||
      lower.match(/day\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(regenerate|redo|refresh|replan)/i);
    if (regenMatch) {
      const dayNumber = parseNumberToken(regenMatch[2] || regenMatch[1]);
      if (dayNumber && trip?.days?.length) {
        regenerateDay(dayNumber);
        showToast(`Regenerating day ${dayNumber}.`);
        return true;
      }
    }

    const replaceMatch = /replace\s+(?:activity|item)|swap\s+(?:activity|item)|change\s+(?:activity|item)/i.test(lower);
    if (replaceMatch) {
      const dayNumber = parseDayNumber(lower);
      const activityIndex = parseActivityIndex(lower);
      if (!dayNumber) {
        showToast("Please specify a valid day number.");
        return true;
      }
      const day = trip?.days?.find((d) => d.day_number === dayNumber);
      if (!day) {
        showToast("Please specify a valid day number.");
        return true;
      }
      const ordered = [...day.activities].sort((a, b) => a.order_index - b.order_index);
      const activity = activityIndex != null ? ordered[activityIndex] : null;
      if (!activity) {
        showToast("Activity number not found.");
        return true;
      }
      replaceActivity(dayNumber, activity.id);
      showToast(`Replacing activity ${activityIndex! + 1} on day ${dayNumber}.`);
      return true;
    }

    const generateMatch =
      /(plan|generate|create|start|make)\b/i.test(lower) &&
      /(trip|itinerary|plan)\b/i.test(lower);
    const updated = applyVoiceInputs(text);
    if (generateMatch) {
      if (!destination.trim() || !interests.trim() || !Number(durationInput) || !Number(budget)) {
        applyVoiceInputs(text);
      }
      if (loading || streaming) {
        showToast("Planning is already running.");
        return true;
      }
      setTimeout(() => generatePlan(), 150);
      return true;
    }

    if (updated) {
      showToast("Trip details updated. Say 'Generate plan' to continue.");
      return true;
    }

    return false;
  };

  const sendChat = async (overrideText?: string, source: "text" | "voice" = "text") => {
    const userMsg = (overrideText ?? chatInput).trim();
    const isVoice = source === "voice";
    if (!userMsg) {
      if (isVoice) setVoiceStatus("idle");
      return;
    }
    if (isVoice) setVoiceStatus("thinking");
    setChatMessages((prev) => [...prev, "You: " + userMsg]);
    setChatInput("");
    setTyping(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history: chatMessages.slice(-6),
        }),
      });

      if (!res.ok) {
        const msg = await parseApiError(res);
        setChatMessages((prev) => [...prev, `Rahi.AI: ${msg}`]);
        if (isVoice) setVoiceStatus("idle");
        return;
      }

      const data = await res.json();
      const aiMsg = data.reply;
      const lang = /[ऀ-ॿ]/.test(aiMsg) ? "hi-IN" : "en-US";
      if (isVoice && voiceSettings.tts) {
        speakWithHeart(
          aiMsg,
          lang,
          undefined,
          undefined,
          () => setVoiceStatus("speaking"),
          () => setVoiceStatus("idle")
        );
      } else {
        if (isVoice) setVoiceStatus("idle");
        if (!isVoice && voiceSettings.tts) speakWithHeart(aiMsg, lang);
      }

      setChatMessages((prev) => [...prev, "Rahi.AI: " + aiMsg]);
      
      if(looksLikeItinerary(aiMsg)) syncFieldsFromChat(aiMsg);
      handleCommands(userMsg, aiMsg);
    } catch {
      setChatMessages((prev) => [...prev, "Rahi.AI: Sorry, I had trouble responding."]);
      if (isVoice) setVoiceStatus("idle");
    } finally {
      setTyping(false);
    }
  };

  // --- STYLES ---
  const glassPanel = "rahi-panel rahi-panel-premium";
  const inputContainer = "relative group rahi-field-group";
  const inputIcon =
    "rahi-field-icon absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 transition-colors group-focus-within:text-teal-300";
  const inputField = "rahi-input rahi-input-premium pl-12 pr-4 py-4";
  const labelStyle = "rahi-label rahi-label-premium mb-2";
  const foldableShell =
    "rahi-fold-shell group mb-6 overflow-hidden rounded-xl border border-white/10 bg-white/5";
  const foldableSummary = "rahi-fold-summary flex list-none items-center justify-between gap-3 px-4 py-3";
  const foldableContent = "rahi-fold-content px-4 pb-4 pt-3";
  const tripDaysCount = trip?.days?.length ?? 0;
  const totalFromActivities = trip?.days?.reduce((sum, day) => {
    const daySum = day.activities.reduce(
      (acc, activity) => acc + (Number(activity.estimated_cost) || 0),
      0
    );
    return sum + daySum;
  }, 0) ?? 0;
  const totalFromMeta = trip?.meta?.total_estimated_budget ?? 0;
  const displayBudget =
    (totalFromMeta > 0 ? totalFromMeta : totalFromActivities) ||
    parseBudget(budget);
  const syncStatusLabel =
    syncStatus === "saving"
      ? "Saving..."
      : syncStatus === "dirty"
        ? "Unsaved changes"
        : syncStatus === "saved"
          ? "All changes saved"
          : syncStatus === "error"
            ? "Save failed"
            : syncStatus === "conflict"
              ? "Sync conflict handled"
              : "";
  const syncStatusClass =
    syncStatus === "error" || syncStatus === "conflict"
      ? "text-red-300"
      : syncStatus === "dirty"
        ? "text-amber-300"
        : "text-teal-300/80";
  const packingSuggestions = useMemo(() => {
    const list = trip?.meta?.packing_suggestions ?? [];
    return list.filter(Boolean).slice(0, 6);
  }, [trip?.meta?.packing_suggestions]);
  const autoStory = useMemo(() => {
    if (!trip?.destination || !tripDaysCount) return "";
    const vibe = (trip.meta?.primary_vibes?.[0] || "").replace(/_/g, " ");
    const vibeText = vibe ? `${vibe} ` : "";
    const highlights = trip.days
      .flatMap((day) => day.activities.map((activity) => activity.title))
      .filter(Boolean)
      .slice(0, 3);
    const highlightText = highlights.length
      ? `Highlights include ${highlights.join(", ")}.`
      : "";
    const paceText = trip.meta?.pace ? `Pace set to ${trip.meta.pace}.` : "";
    return `Rahi.AI crafted a ${tripDaysCount}-day ${vibeText}escape to ${
      trip.destination
    }. ${highlightText} ${paceText}`
      .replace(/\s+/g, " ")
      .trim();
  }, [trip, tripDaysCount]);
  const signatureStory = trip?.meta?.signature_story || autoStory;
  const pdfTrip = trip ?? {
    destination: destination || "Your Trip",
    days: [],
    meta: {
      total_estimated_budget: Number.isFinite(displayBudget)
        ? displayBudget
        : 0,
    },
    share_code: undefined,
    is_public: true,
  };
  const isPrivateTrip = pdfTrip.is_public === false;
  const pdfInterests = interests || "Custom interests";
  const coverThemeLabels: Record<string, string> = {
    ocean: "Ocean Escape",
    alpine: "Alpine Adventure",
    desert: "Desert Heritage",
    forest: "Forest Retreat",
    city: "City Lights",
  };
  const autoCoverTheme = (() => {
    const haystack = `${tripType} ${pdfInterests} ${pdfTrip.destination}`.toLowerCase();
    if (/(beach|island|ocean|sea|coast|lagoon)/.test(haystack)) return "ocean";
    if (/(mountain|trek|hike|adventure|hill|snow|alps)/.test(haystack)) return "alpine";
    if (/(desert|dune|safari|heritage|fort|palace|rajasthan)/.test(haystack)) return "desert";
    if (/(forest|wildlife|jungle|eco|nature|national park)/.test(haystack)) return "forest";
    return "city";
  })();
  const autoCoverThemeLabel = coverThemeLabels[autoCoverTheme] || "Signature Journey";
  const activeCoverTheme =
    pdfIsPremium && pdfThemeOverride ? pdfThemeOverride : autoCoverTheme;
  const coverThemeLabel = coverThemeLabels[activeCoverTheme] || "Signature Journey";
  const pdfHighlights = pdfTrip.days
    .flatMap((day) => day.activities)
    .slice(0, 5);
  const pdfPacking = [
    "Government ID and tickets",
    "Comfortable walking shoes",
    "Power bank and adapters",
    "Light jacket or rain cover",
    "Reusable water bottle",
  ];
  const pdfChecklist = PREMIUM_CHECKLIST.map((item) => ({
    ...item,
    done: Boolean(prepChecklist[item.id]),
  }));
  const pdfBudgetBreakdown = [
    { label: "Experiences", value: Math.round(displayBudget * 0.55), color: "#0f766e" },
    { label: "Food", value: Math.round(displayBudget * 0.25), color: "#f59e0b" },
    { label: "Transit", value: Math.round(displayBudget * 0.15), color: "#38bdf8" },
    { label: "Misc", value: Math.round(displayBudget * 0.05), color: "#a855f7" },
  ];
  const pdfBudgetTotal = pdfBudgetBreakdown.reduce((sum, item) => sum + item.value, 0);
  const tripHealth = useMemo(() => {
    if (!trip?.days || trip.days.length === 0) return null;
    const issues: { id: string; severity: "low" | "medium" | "high"; message: string; day?: number }[] = [];
    const titleMap = new Map<string, number>();
    const fixableDays = new Set<number>();
    let missingLocations = 0;
    let duplicateActivities = 0;
    let dayCountWarnings = 0;

    trip.days.forEach((day) => {
      const count = day.activities.length;
      if (count < 3) {
        issues.push({
          id: `day-${day.day_number}-few`,
          severity: "medium",
          message: `Day ${day.day_number} has only ${count} activities.`,
          day: day.day_number,
        });
        fixableDays.add(day.day_number);
        dayCountWarnings += 1;
      } else if (count > 6) {
        issues.push({
          id: `day-${day.day_number}-many`,
          severity: "low",
          message: `Day ${day.day_number} feels packed with ${count} activities.`,
          day: day.day_number,
        });
        fixableDays.add(day.day_number);
        dayCountWarnings += 1;
      }

      day.activities.forEach((activity) => {
        const titleKey = (activity.title || "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();
        if (titleKey) {
          const existingDay = titleMap.get(titleKey);
          if (existingDay && existingDay !== day.day_number) {
            duplicateActivities += 1;
            issues.push({
              id: `dup-${existingDay}-${day.day_number}-${titleKey}`,
              severity: "high",
              message: `Duplicate activity across days ${existingDay} and ${day.day_number}: ${activity.title}.`,
              day: day.day_number,
            });
            fixableDays.add(day.day_number);
          } else {
            titleMap.set(titleKey, day.day_number);
          }
        }

        const locName = activity.location?.name?.trim() || "";
        const lat = Number(activity.location?.lat ?? 0);
        const lng = Number(activity.location?.lng ?? 0);
        const missingLocation =
          !locName ||
          locName.toLowerCase() === "unknown" ||
          (!Number.isFinite(lat) && !Number.isFinite(lng)) ||
          (lat === 0 && lng === 0);
        if (missingLocation) {
          missingLocations += 1;
          issues.push({
            id: `loc-${day.day_number}-${activity.id}`,
            severity: "medium",
            message: `Missing location data in Day ${day.day_number}: ${activity.title}.`,
            day: day.day_number,
          });
          fixableDays.add(day.day_number);
        }
      });
    });

    const budgetOver =
      Number.isFinite(displayBudget) &&
      totalFromActivities > (displayBudget || 0) * 1.1;
    if (budgetOver) {
      issues.push({
        id: "budget-over",
        severity: "high",
        message: `Estimated spend ₹${formatCurrency(totalFromActivities)} exceeds budget.`,
      });
    }

    const score = Math.max(
      30,
      100 - issues.length * 6 - (budgetOver ? 10 : 0)
    );

    return {
      issues,
      fixableDays: Array.from(fixableDays).sort((a, b) => a - b),
      summary: {
        score,
        missingLocations,
        duplicateActivities,
        dayCountWarnings,
        budgetOver,
      },
    };
  }, [trip, displayBudget, totalFromActivities]);

  const premiumInsights = useMemo(() => {
    if (!trip?.days || trip.days.length === 0) return null;
    const activityTypes = new Set<string>();
    const dayStats: DayStat[] = trip.days.map((day) => {
      const cost = day.activities.reduce(
        (sum, activity) => sum + (Number(activity.estimated_cost) || 0),
        0
      );
      const duration = day.activities.reduce(
        (sum, activity) => sum + (activity.duration_minutes || 0),
        0
      );
      let distance = 0;
      let lastCoord: [number, number] | null = null;
      day.activities.forEach((activity) => {
        if (activity.type) activityTypes.add(activity.type);
        const coord = getActivityCoord(activity);
        if (coord && lastCoord) {
          distance += haversineKm(lastCoord, coord);
        }
        if (coord) lastCoord = coord;
      });
      return {
        day: day.day_number,
        count: day.activities.length,
        cost,
        duration,
        distance,
      };
    });
    const flattened = trip.days.flatMap((day) =>
      day.activities.map((activity) => ({
        activity,
        day: day.day_number,
        cost: Number(activity.estimated_cost) || 0,
      }))
    );
    const expensiveActivity = flattened.reduce<
      { day: number; activity: Activity; cost: number } | null
    >((max, current) => {
      if (!max) return current;
      return current.cost > max.cost ? current : max;
    }, null);
    const overloadedDays = dayStats.filter((stat) => stat.count > 6);
    const underloadedDays = dayStats.filter((stat) => stat.count < 3);
    const canOptimize = trip.days.some(
      (day) => day.activities.filter((activity) => getActivityCoord(activity)).length >= 2
    );
    const safeBudget = Number.isFinite(displayBudget) ? displayBudget || 0 : 0;
    const budgetDelta = safeBudget ? totalFromActivities - safeBudget : 0;
    const avgPerDay = trip.days.length
      ? Math.round((safeBudget || totalFromActivities) / trip.days.length)
      : 0;
    const totalDuration = dayStats.reduce((sum, stat) => sum + stat.duration, 0);
    const avgDuration = trip.days.length
      ? Math.round(totalDuration / trip.days.length)
      : 0;
    const totalDistanceKm = dayStats.reduce(
      (sum, stat) => sum + stat.distance,
      0
    );
    const varietyScore = ACTIVITY_TYPE_COUNT
      ? Math.round((activityTypes.size / ACTIVITY_TYPE_COUNT) * 100)
      : 0;
    const busiestDay = dayStats.reduce<DayStat | null>(
      (max, stat) => (!max || stat.duration > max.duration ? stat : max),
      null
    );
    return {
      dayStats,
      expensiveActivity,
      overloadedDays,
      underloadedDays,
      canOptimize,
      budgetDelta,
      avgPerDay,
      avgDuration,
      totalDistanceKm: Math.round(totalDistanceKm),
      activityTypesCount: activityTypes.size,
      varietyScore,
      busiestDay,
    };
  }, [trip, displayBudget, totalFromActivities]);

  const budgetCopilot = useMemo(() => {
    if (!trip?.days?.length) return null;

    const parsedBudget = parseBudget(budget);
    const hasTargetBudget = Number.isFinite(displayBudget) && Number(displayBudget) > 0;
    const targetBudget = hasTargetBudget
      ? Number(displayBudget)
      : Number.isFinite(parsedBudget) && parsedBudget > 0
        ? parsedBudget
        : Math.max(totalFromActivities, 0);
    const currentSpend = totalFromActivities;
    const budgetDelta = hasTargetBudget ? currentSpend - targetBudget : 0;
    const utilizationPercent =
      hasTargetBudget && targetBudget > 0
        ? Math.round((currentSpend / targetBudget) * 100)
        : 0;
    const dayTarget = trip.days.length
      ? Math.round(targetBudget / trip.days.length)
      : 0;

    const dayCosts = trip.days
      .map((day) => ({
        day: day.day_number,
        cost: day.activities.reduce(
          (sum, activity) => sum + (Number(activity.estimated_cost) || 0),
          0
        ),
      }))
      .sort((a, b) => b.cost - a.cost);

    const expensiveStops = trip.days
      .flatMap((day) =>
        day.activities.map((activity) => ({
          day: day.day_number,
          id: activity.id,
          title: activity.title,
          cost: Number(activity.estimated_cost) || 0,
        }))
      )
      .sort((a, b) => b.cost - a.cost);

    const focusDays =
      hasTargetBudget && dayTarget > 0
        ? dayCosts.filter((day) => day.cost > dayTarget * 1.2).slice(0, 3)
        : [];

    const recommendations: string[] = [];
    if (!hasTargetBudget) {
      recommendations.push("Set a target budget to unlock auto-trim recommendations.");
    }
    if (hasTargetBudget && budgetDelta > 0) {
      recommendations.push(
        `You are over budget by ₹${formatCurrency(Math.round(budgetDelta))}.`
      );
      if (focusDays[0]) {
        recommendations.push(
          `Day ${focusDays[0].day} is the main overspend driver right now.`
        );
      }
      if (expensiveStops[0]) {
        recommendations.push(
          `Swap "${expensiveStops[0].title}" for a lower-cost alternative.`
        );
      }
    } else if (hasTargetBudget) {
      recommendations.push("Spend is within budget. Keep this pace for the remaining days.");
      if (dayTarget > 0) {
        recommendations.push(
          `Try to stay near ₹${formatCurrency(dayTarget)} per day for consistency.`
        );
      }
    }

    return {
      targetBudget,
      hasTargetBudget,
      currentSpend,
      budgetDelta,
      utilizationPercent,
      dayTarget,
      dayCosts,
      focusDays,
      expensiveStops,
      recommendations,
      canAutoTrim:
        planCapabilities.activitySwap &&
        hasTargetBudget &&
        budgetDelta > 0 &&
        expensiveStops.length > 0,
    };
  }, [trip, budget, displayBudget, totalFromActivities, planCapabilities.activitySwap]);

  const weatherRiskDays = useMemo(() => {
    if (!trip?.days?.length || !weather?.length) return [];
    return trip.days
      .map((day) => {
        const weatherText =
          weather?.[day.day_number - 1]?.weather?.[0]?.description?.toLowerCase() ?? "";
        return WEATHER_RISK_PATTERN.test(weatherText) ? day.day_number : null;
      })
      .filter((day): day is number => day !== null);
  }, [trip?.days, weather]);

  const stayFit = useMemo(() => {
    if (!trip) return null;
    const safeBudget = Number.isFinite(displayBudget)
      ? displayBudget || 0
      : totalFromActivities || 0;
    const budgetPerDay = tripDaysCount
      ? Math.round(safeBudget / tripDaysCount)
      : 0;
    const pace = trip.meta?.pace || "balanced";
    let score = 55;
    if (budgetPerDay >= 3500) score += 25;
    else if (budgetPerDay >= 2500) score += 18;
    else if (budgetPerDay >= 1500) score += 10;
    else score -= 5;
    if (pace === "relaxed") score += 5;
    if (pace === "packed") score -= 5;
    if ((premiumInsights?.totalDistanceKm ?? 0) >= 12) score -= 5;
    if ((premiumInsights?.totalDistanceKm ?? 0) <= 5) score += 5;
    score = Math.min(95, Math.max(35, score));

    const vibe = trip.meta?.primary_vibes?.[0] || "";
    const areaTips = [
      vibe === "nightlife" && "Stay near central entertainment districts for late-night safety.",
      vibe === "nature" && "Pick stays closer to parks, ghats, or foothill zones to cut commute time.",
      vibe === "cultural" && "Old town/heritage cores keep you near monuments and markets.",
      vibe === "chill" && "Choose quieter residential areas within 10-15 minutes of the center.",
      vibe === "budget_friendly" && "Transit-adjacent areas reduce cab spend while staying connected.",
      vibe === "high_energy" && "Central hubs keep the day packed with minimal travel time.",
    ].filter(Boolean) as string[];

    const commuteTip =
      (premiumInsights?.totalDistanceKm ?? 0) >= 12
        ? "Cluster stays by zone to avoid long cross-city hops."
        : "Staying central keeps ride times short and plans flexible.";

    const budgetGuide =
      budgetPerDay >= 3000
        ? "Comfort stay: boutique or 3–4★ options with flexible neighborhoods."
        : budgetPerDay >= 1800
          ? "Value stay: clean 2–3★ stays close to transit and eateries."
          : "Budget stay: dorms/guesthouses and walkable areas to save commute costs.";

    return {
      score,
      budgetPerDay,
      pace,
      areaTips: areaTips.length ? areaTips : ["Pick a central, well-connected area for easy access."],
      commuteTip,
      budgetGuide,
    };
  }, [trip, displayBudget, totalFromActivities, tripDaysCount, premiumInsights]);

  const groupBudgetTotal = useMemo(() => {
    const safeBudget = Number.isFinite(displayBudget)
      ? displayBudget || 0
      : totalFromActivities || 0;
    return Math.max(safeBudget, 0);
  }, [displayBudget, totalFromActivities]);
  const groupMemberCount = Math.max(groupMembers.length, 1);
  const groupPerPerson = groupMemberCount
    ? Math.round(groupBudgetTotal / groupMemberCount)
    : 0;

  const selectedDayWeather = useMemo(() => {
    if (!weather?.length) return null;
    const index = Math.max(selectedDay - 1, 0);
    return weather[index] ?? null;
  }, [weather, selectedDay]);

  const stagePrimaryAction = useMemo(() => {
    if (plannerMode === "chat") return null;
    if (plannerStage === "build") {
      return {
        label: loading ? "Planning..." : plannerMode === "budget" ? "Optimize Budget" : "Generate Plan",
        onClick: () => void generatePlan(),
        disabled: loading || streaming,
      };
    }
    if (plannerStage === "optimize") {
      return {
        label: dynamicReplanning
          ? "Replanning..."
          : isPro
            ? "Run Dynamic Replan"
            : "Run Dynamic Replan (Pro)",
        onClick: () => void runDynamicReplan(),
        disabled: !isPro || dynamicReplanning || loading || streaming,
      };
    }
    return {
      label: trip?.share_code
        ? trip?.is_public === false
          ? "Share Private Link"
          : "Share Trip"
        : pdfIsPremium
          ? "Download Premium PDF"
          : "Download PDF",
      onClick: () => {
        if (trip?.share_code) {
          shareTripLink();
          return;
        }
        downloadPDF();
      },
      disabled: loading || streaming,
    };
  }, [
    plannerMode,
    plannerStage,
    loading,
    streaming,
    dynamicReplanning,
    isPro,
    trip?.share_code,
    trip?.is_public,
    pdfIsPremium,
  ]);

  const controlCenter = useMemo(() => {
    if (!trip || plannerStage !== "optimize") return null;
    const healthScore = tripHealth?.summary.score ?? 0;
    const budgetDelta = Math.round(budgetCopilot?.budgetDelta ?? 0);
    const weatherRiskCount = weatherRiskDays.length;
    const routeReady = Boolean(premiumInsights?.canOptimize);

    let statusLabel = "Balanced";
    if (budgetDelta > 0 || weatherRiskCount > 0 || healthScore < 75) {
      statusLabel = "Needs attention";
    } else if (healthScore >= 90 && budgetDelta <= 0 && weatherRiskCount === 0) {
      statusLabel = "Ready to share";
    }

    return {
      statusLabel,
      healthScore,
      budgetDelta,
      weatherRiskCount,
      routeReady,
    };
  }, [
    trip,
    plannerStage,
    tripHealth?.summary.score,
    budgetCopilot?.budgetDelta,
    weatherRiskDays,
    premiumInsights?.canOptimize,
  ]);

  return (
    <main className="rahi-planner-page relative min-h-screen overflow-hidden bg-black text-white selection:bg-teal-500 selection:text-black">
      <a href="#planner-main-content" className="rahi-skip-link">
        Skip to planner content
      </a>
      {/* 1. GLOBAL ANIMATED BACKGROUND */}
      <RahiBackground />

      {checkingAuth ? (
        <div className="min-h-screen flex items-center justify-center text-teal-300 px-6">
          <div className="rahi-panel rahi-panel-premium px-8 py-6 flex flex-col items-center gap-4">
            <div className="h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <p className="animate-pulse">Loading Rahi.AI...</p>
          </div>
        </div>
      ) : (
        <>
        <div id="planner-main-content" className="rahi-planner-shell relative z-10 mx-auto max-w-[1580px] px-4 pb-10 pt-4 sm:px-6 md:px-10 md:pt-6">
        <header className="rahi-topbar mb-6 flex flex-col items-start justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center">
          <div className="rahi-logo rahi-planner-brand flex items-center gap-2 text-lg font-display font-bold text-white">
            <img
              src="/brand/rahi-mark.svg"
              alt="Rahi.AI"
              className="h-8 w-8 rounded-lg border border-white/10 shadow-[0_0_22px_rgba(20,184,166,0.42)]"
            />
            Rahi.AI
          </div>
          <div className="rahi-topbar-actions flex flex-wrap items-center gap-2">
            {trip && plannerStage === "build" && (
              <button
                type="button"
                className="rahi-btn-secondary text-xs px-3 py-2"
                aria-pressed={focusView}
                onClick={() => setFocusView((prev) => !prev)}
              >
                {focusView ? (
                  <>
                    <PanelLeftOpen className="h-3.5 w-3.5" />
                    Show Inputs
                  </>
                ) : (
                  <>
                    <PanelLeftClose className="h-3.5 w-3.5" />
                    Focus Result
                  </>
                )}
              </button>
            )}
            <a href="/" className="rahi-btn-secondary text-xs px-3 py-2">
              Home
            </a>
            <ThemeToggle />
          </div>
        </header>
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="rahi-toast fixed right-6 top-6 z-50 rounded-xl border border-white/10 bg-black/80 px-4 py-2 text-sm text-white shadow-lg backdrop-blur"
          >
            {toast}
          </div>
        )}

        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: premiumEase }}
          className="rahi-hero-panel mb-8 text-center"
        >
          <div className="rahi-status-pill mb-3 inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-teal-300 animate-pulse" />
            <span className="text-sm font-mono tracking-widest uppercase">
              Rahi.AI System Active
            </span>
          </div>
          <h1 className="rahi-hero-title mb-2 font-display font-black tracking-tight text-white">
            {MODE_CONFIG[plannerMode]?.title}
          </h1>
          <p className="rahi-hero-subtitle mx-auto max-w-2xl text-lg">
            {MODE_CONFIG[plannerMode]?.subtitle}
            {tripType !== "general" && (
              <span className="mt-1 block text-sm italic text-teal-200">
                Currently optimized for: {TYPE_HINTS[tripType]}
              </span>
            )}
          </p>

          <div className="rahi-mode-switch mt-5">
            {MODE_ORDER.map((modeKey) => {
              const active = plannerMode === modeKey;
              const label =
                modeKey === "ai"
                  ? "Planner"
                  : modeKey === "budget"
                    ? "Budget"
                    : "Chat";
              return (
                <button
                  key={modeKey}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  aria-label={`Switch planner mode to ${label}`}
                  className={`rahi-mode-chip ${active ? "is-active" : ""}`}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("mode", modeKey);
                    router.push(`/planner?${params.toString()}`);
                  }}
                >
                  {modeKey === "ai" ? (
                    <Sparkles className="h-3.5 w-3.5" />
                  ) : modeKey === "budget" ? (
                    <IndianRupee className="h-3.5 w-3.5" />
                  ) : (
                    <MessageSquare className="h-3.5 w-3.5" />
                  )}
                  {label}
                </button>
              );
            })}
          </div>
          {plannerMode !== "chat" && (
            <div className="rahi-mode-switch mt-3">
              {PLANNER_STAGE_ORDER.map((stageKey) => {
                const active = plannerStage === stageKey;
                const blocked = Boolean(STAGE_CONFIG[stageKey].requiresTrip && !trip);
                const icon =
                  stageKey === "build" ? (
                    <Compass className="h-3.5 w-3.5" />
                  ) : stageKey === "optimize" ? (
                    <Settings className="h-3.5 w-3.5" />
                  ) : (
                    <Share2 className="h-3.5 w-3.5" />
                  );
                return (
                  <button
                    key={stageKey}
                    type="button"
                    aria-current={active ? "step" : undefined}
                    aria-label={`Switch planner stage to ${STAGE_CONFIG[stageKey].label}`}
                    onClick={() => setPlannerStage(stageKey)}
                    disabled={blocked}
                    className={`rahi-mode-chip ${active ? "is-active" : ""} ${
                      blocked ? "opacity-60" : ""
                    }`}
                    title={STAGE_CONFIG[stageKey].hint}
                  >
                    {icon}
                    {STAGE_CONFIG[stageKey].label}
                  </button>
                );
              })}
            </div>
          )}
          {plannerMode !== "chat" && (
            <p className="mt-2 text-xs text-gray-400">
              Stage:{" "}
              <span className="text-teal-200">{STAGE_CONFIG[plannerStage].label}</span>{" "}
              - {STAGE_CONFIG[plannerStage].hint}
            </p>
          )}
          {plannerMode !== "chat" && stagePrimaryAction && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={stagePrimaryAction.onClick}
                disabled={stagePrimaryAction.disabled}
                className="rahi-btn-primary px-4 py-2 text-sm disabled:opacity-60"
              >
                {stagePrimaryAction.label}
              </button>
              {plannerStage === "optimize" && (
                <button
                  type="button"
                  className="rahi-btn-secondary px-4 py-2 text-sm"
                  onClick={() => setPlannerStage("share")}
                  disabled={!trip}
                >
                  Continue to Share
                </button>
              )}
              {plannerStage === "share" && (
                <button
                  type="button"
                  className="rahi-btn-secondary px-4 py-2 text-sm"
                  onClick={() => setPlannerStage("optimize")}
                >
                  Back to Optimize
                </button>
              )}
            </div>
          )}
          <div className="rahi-hero-metrics mt-4">
            <div className="rahi-hero-metric">
              <span className="rahi-hero-metric-label">Days</span>
              <span className="rahi-hero-metric-value">{tripDaysCount || Number(durationInput) || "--"}</span>
            </div>
            <div className="rahi-hero-metric">
              <span className="rahi-hero-metric-label">Budget</span>
              <span className="rahi-hero-metric-value">₹{formatCurrency(displayBudget || 0)}</span>
            </div>
            <div className="rahi-hero-metric">
              <span className="rahi-hero-metric-label">Saved Trips</span>
              <span className="rahi-hero-metric-value">{history.length}</span>
            </div>
          </div>
        </motion.div>

        {plannerMode === "chat" ? (
          <PlannerChatPanel
            glassPanel={glassPanel}
            premiumEase={premiumEase}
            chatMessages={chatMessages}
            typing={typing}
            chatInput={chatInput}
            setChatInput={setChatInput}
            sendChat={sendChat}
            looksLikeItinerary={looksLikeItinerary}
            syncFieldsFromChat={syncFieldsFromChat}
            onSwitchToPlannerMode={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("mode", "ai");
              router.push(`/planner?${params.toString()}`);
            }}
            voiceSettingsOpen={voiceSettingsOpen}
            setVoiceSettingsOpen={setVoiceSettingsOpen}
            voiceSettingsContent={
              <VoiceSettingsCard
                voiceSettings={voiceSettings}
                setVoiceSettings={setVoiceSettings}
              />
            }
            handleVoiceCommand={handleVoiceCommand}
            setListening={setListening}
            setVoiceStatus={setVoiceStatus}
            voiceStatus={voiceStatus}
            voiceSettings={voiceSettings}
            bottomRef={bottomRef}
          />
        ) : (
          /* ---------------- PLANNER / BUDGET MODE UI ---------------- */
          <div className={`rahi-planner-grid grid gap-6 md:gap-8 ${focusView ? "lg:grid-cols-1 is-focus" : "lg:grid-cols-12"}`}>
            
            {/* LEFT COLUMN: INPUT FORM */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: premiumEase }}
              className={`${
                focusView || plannerStage !== "build" ? "hidden" : "lg:col-span-5"
              } ${glassPanel} rahi-planner-form-panel h-fit p-5 md:p-7 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto custom-scrollbar`}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-teal-500/20 rounded-lg">
                    <Compass className="w-6 h-6 text-teal-400" />
                </div>
                <div>
                  <h2 className="text-xl font-display font-bold text-white">Trip Details</h2>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-teal-200/75">Live itinerary control</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rahi-card p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className={labelStyle}>India Template Packs</span>
                    <button
                      type="button"
                      onClick={() => setShowAllTemplates((prev) => !prev)}
                      className="text-[10px] text-gray-300 uppercase tracking-[0.16em] px-2 py-1 rounded-full border border-white/15 hover:border-teal-400/40 hover:text-teal-200 transition"
                    >
                      {showAllTemplates ? "Show less" : `View all ${INDIA_TEMPLATE_PRESETS.length}`}
                    </button>
                  </div>
                  <div className={`${showAllTemplates ? "max-h-[272px] overflow-y-auto pr-1 custom-scrollbar" : ""}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2.5 gap-y-3">
                    {visibleTemplatePacks.map((template) => {
                      const isActive = activeTemplateId === template.id;
                      const style =
                        TEMPLATE_CARD_STYLES[template.vibe] || TEMPLATE_CARD_STYLES.default;
                      return (
                        <div
                          key={template.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => applyIndiaTemplate(template)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              applyIndiaTemplate(template);
                            }
                          }}
                          className={`group relative overflow-hidden rounded-xl border p-3 min-h-[134px] text-left transition cursor-pointer ${
                            isActive
                              ? "border-teal-300/70 bg-white/[0.07] shadow-[0_0_0_1px_rgba(20,184,166,0.2),0_10px_24px_rgba(10,25,48,0.45)]"
                              : "border-white/10 bg-black/25 hover:border-teal-500/45 hover:bg-white/[0.05]"
                          }`}
                        >
                          <div
                            className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${style.glow} opacity-80`}
                          />
                          <div className="relative z-10 space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-white">{template.title}</p>
                              <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.badgeTone}`}
                              >
                                {style.badge}
                              </span>
                            </div>
                            <p className={`text-[10px] ${style.accent}`}>
                              {template.destination} • {template.days}D • ₹{formatCurrency(template.budget)}
                            </p>
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] capitalize ${style.chipTone}`}
                              >
                                {template.vibe}
                              </span>
                              <button
                                type="button"
                                disabled={loading || streaming}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  applyIndiaTemplate(template, false);
                                }}
                                className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[10px] font-semibold text-white transition hover:border-teal-300/60 hover:text-teal-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                Use
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={loading || streaming}
                    onClick={() => {
                      if (!activeIndiaTemplate) {
                        showToast("Select a template first.");
                        return;
                      }
                      applyIndiaTemplate(activeIndiaTemplate, false);
                    }}
                    className="mt-3 w-full rahi-btn-secondary text-xs disabled:opacity-60 disabled:cursor-not-allowed border-white/20"
                  >
                    <Compass className="w-4 h-4" />
                    {activeIndiaTemplate ? `Use ${activeIndiaTemplate.title}` : "Use Selected Template"}
                  </button>
                </div>

                <div className={inputContainer}>
                  <label className={labelStyle}>Where to?</label>
                  <MapPin className={inputIcon} />
                  <input
                    className={inputField}
                    placeholder="E.g., Goa, Manali, Jaipur"
                    value={destination}
                    onChange={(e) => {
                      setDestination(e.target.value);
                      setActiveTemplateId(null);
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className={inputContainer}>
                     <label className={labelStyle}>Budget</label>
                     <IndianRupee className={inputIcon} />
                     <input
                       className={inputField}
                       placeholder="10000"
                       value={budget}
                       onChange={(e) => {
                         setBudget(e.target.value);
                         setActiveTemplateId(null);
                       }}
                     />
                   </div>
                   <div className={inputContainer}>
                     <label className={labelStyle}>Duration</label>
                     <Calendar className={inputIcon} />
                     <input
                       className={inputField}
                       placeholder="Days"
                       value={durationInput}
                       onChange={(e) => {
                         setDurationInput(e.target.value);
                         setActiveTemplateId(null);
                       }}
                     />
                   </div>
                </div>

                <div className={inputContainer}>
                  <label className={labelStyle}>Vibe / Interests</label>
                  <Compass className={inputIcon} />
                  <input
                    className={inputField}
                    placeholder="E.g., Beach, Trekking, Party"
                    value={interests}
                    onChange={(e) => {
                      setInterests(e.target.value);
                      setActiveTemplateId(null);
                    }}
                  />
                </div>

                {formError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {formError}
                  </div>
                )}

                <button
                  onClick={() => void generatePlan()}
                  disabled={loading}
                  className="w-full mt-2 rahi-btn-primary py-4 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Planning...
                    </>
                  ) : plannerMode === "budget" ? (
                    "Optimize Budget"
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" /> Generate Plan
                    </>
                  )}
                </button>

                <div className="mt-6 rahi-card p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="rahi-label">Rahi Voice</span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-[0.18em]">
                      Hands-free
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <RahiVoiceUI
                      onText={(text) => {
                        if (handleVoiceCommand(text)) {
                          setVoiceStatus("idle");
                          return;
                        }
                        showToast("Try: Plan 3 days in Goa under 8k.");
                      }}
                      onListening={(active) => {
                        setListening(active);
                        setVoiceStatus((prev) => {
                          if (active) return "listening";
                          return prev === "listening" ? "idle" : prev;
                        });
                      }}
                      status={voiceStatus}
                      lang={voiceSettings.lang}
                      autoSend={voiceSettings.autoSend}
                      earcons={voiceSettings.earcons}
                    />
                    <p className="text-[11px] text-gray-400 text-center">
                      Try: “Plan 3 days in Goa under 8k.”
                    </p>
                    <button
                      type="button"
                      className="rahi-btn-ghost text-[10px]"
                      onClick={() => setVoiceSettingsOpen((prev) => !prev)}
                    >
                      <Settings className="w-3 h-3" />
                      Voice settings
                    </button>
                    {voiceSettingsOpen && (
                      <div className="mt-2 w-full">
                        <VoiceSettingsCard
                          voiceSettings={voiceSettings}
                          setVoiceSettings={setVoiceSettings}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* HISTORY SECTION */}
              {history.length > 0 && (
                <div className="mt-8 pt-6 border-t border-white/10">
                  <div className="flex items-center gap-2 mb-4 text-gray-400">
                    <History className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Recent Trips</span>
                  </div>
                  <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                    {history.map((t, i) => (
                      <div
                        key={t.tripData?.id || t.tripData?.share_code || `${t.destination}-${t.time}`}
                        className="group flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-teal-500/30 transition cursor-pointer"
                        role="button"
                        tabIndex={0}
                        aria-label={`Load saved trip for ${t.destination}`}
                        onClick={() => {
                          loadHistoryTrip(t);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            loadHistoryTrip(t);
                          }
                        }}
                      >
                        <div>
                            <p className="font-bold text-teal-400 text-sm">{t.destination}</p>
                            <p className="text-xs text-gray-500">{t.daysInput} Days • ₹{t.budgetInput}</p>
                        </div>
                        <button
                          type="button"
                          aria-label={`Delete saved trip for ${t.destination}`}
                          onClick={(e) => {
                             e.stopPropagation();
                             deleteTrip(i);
                          }}
                          className="p-1.5 rounded-md hover:bg-red-500/20 text-gray-600 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>

            {/* RIGHT COLUMN: OUTPUT */}
            <motion.div 
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ duration: 0.6, ease: premiumEase }}
               className={`${
                 plannerStage !== "build"
                   ? "lg:col-span-12"
                   : focusView
                     ? "lg:col-span-1"
                     : "lg:col-span-7"
               } ${glassPanel} rahi-planner-result-panel relative flex min-h-[520px] flex-col p-5 md:min-h-[600px] md:p-7`}
            >
              {loading && !streaming && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20 rounded-2xl">
                   <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
                   <p className="text-teal-400 font-bold animate-pulse">Initializing Trip Engine...</p>
                </div>
              )}

              {streamError && (
                <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {streamError}
                </div>
              )}

              {!trip ? (
                <div className="flex flex-col justify-center flex-1">
                  <div className="rahi-card border border-white/10 rounded-2xl p-5 md:p-6 bg-gradient-to-br from-white/[0.04] via-transparent to-teal-500/[0.05]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-teal-300/80">Sample Plan Preview</p>
                        <h3 className="text-xl font-display font-bold text-white mt-2">
                          {emptyStateTemplate.title}
                        </h3>
                        <p className="text-sm text-gray-300 mt-1">
                          {emptyStateTemplate.destination} • {emptyStateTemplate.days} days • ₹
                          {formatCurrency(emptyStateTemplate.budget)}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl border border-white/10 bg-black/25">
                        <Plane className="w-7 h-7 text-teal-300/80" />
                      </div>
                    </div>

                    <div className="mt-5 space-y-2">
                      {emptyStatePreviewStops.map((item, index) => (
                        <div
                          key={`${item}-${index}`}
                          className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-gray-200"
                        >
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-teal-400/40 bg-teal-500/15 text-[11px] text-teal-200">
                            {index + 1}
                          </span>
                          {item}
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-gray-300">
                        {emptyStateTemplate.vibe} vibes
                      </span>
                      <span className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-gray-300">
                        India-ready template
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={loading || streaming}
                      onClick={() => applyIndiaTemplate(emptyStateTemplate, true)}
                      className="mt-6 w-full rahi-btn-primary py-3 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="w-4 h-4" />
                      Generate This Plan
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-4 text-center">
                    Or customize details on the left and generate a completely custom itinerary.
                  </p>
                </div>
              ) : (
                <>
                  {/* Result Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-white/10 pb-6">
                    <div>
                      <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
                        {trip.destination} <span className="text-teal-500">Adventure</span>
                      </h2>
                       <p className="text-gray-400 text-sm">
                        {tripDaysCount} Day{tripDaysCount > 1 ? "s" : ""} • Budget: ₹{formatCurrency(displayBudget || 0)}
                       </p>
                     </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {trip.id && syncStatusLabel && (
                        <span
                          className={`text-xs ${syncStatusClass} ${
                            syncStatus === "saving" ? "animate-pulse" : ""
                          }`}
                        >
                          {syncStatusLabel}
                        </span>
                      )}
                      <span className="rounded-full border border-teal-400/40 bg-teal-500/10 px-3 py-1 text-[10px] font-bold tracking-[0.12em] text-teal-200">
                        {tierBadgeLabel}
                      </span>
                      {effectiveTier === "basic" && trialStatus === "active" && (
                        <span
                          className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold text-amber-200"
                          title={
                            trialEndsAt
                              ? `Trial ends on ${new Date(trialEndsAt).toLocaleDateString("en-IN")}`
                              : undefined
                          }
                        >
                          Trial {trialDaysLeft}d left
                        </span>
                      )}
                      {trip.id && hasUnsavedChanges && !savingChanges && (
                        <button
                          onClick={() => void persistTripResult(trip, { reason: "manual" })}
                          className="rahi-btn-secondary text-xs px-3 py-1.5"
                        >
                          Save now
                        </button>
                      )}
                      {plannerStage === "share" && (
                        <>
                          {isPremium ? (
                            hasStripeCustomer ? (
                              <button
                                onClick={manageBilling}
                                disabled={billingLoading}
                                className="rahi-btn-secondary text-sm disabled:opacity-60"
                              >
                                {billingLoading ? "Opening..." : "Manage Plan"}
                              </button>
                            ) : (
                              <span className="rounded-full border border-emerald-400/45 bg-emerald-500/12 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                                {isPro ? "Pro" : "Premium"} Active (UPI)
                              </span>
                            )
                          ) : upiEnabled ? (
                            <button
                              onClick={() => {
                                setUpiOpen(true);
                                setUpiError(null);
                                if (!upiPaymentId) {
                                  void startUpgrade("premium");
                                }
                              }}
                              disabled={billingLoading}
                              className="rahi-btn-primary px-4 py-2 text-sm disabled:opacity-60"
                            >
                              {billingLoading ? "Opening..." : "Upgrade Premium"}
                            </button>
                          ) : premiumEnabled ? (
                            <button
                              onClick={() => void startUpgrade("premium")}
                              disabled={billingLoading}
                              className="rahi-btn-primary px-4 py-2 text-sm disabled:opacity-60"
                            >
                              {billingLoading ? "Opening..." : "Upgrade Premium"}
                            </button>
                          ) : (
                            <button
                              onClick={() => setWaitlistOpen(true)}
                              className="rahi-btn-primary px-4 py-2 text-sm"
                            >
                              Premium Soon
                            </button>
                          )}
                          {premiumEnabled && !isPro && (
                            <button
                              onClick={() => void startUpgrade("pro")}
                              disabled={billingLoading}
                              className="rahi-btn-secondary px-4 py-2 text-sm disabled:opacity-60"
                            >
                              {billingLoading ? "Opening..." : "Go Pro"}
                            </button>
                          )}
                          <button
                            onClick={downloadPDF}
                            className="rahi-btn-secondary"
                          >
                            <Download className="w-4 h-4" /> {pdfIsPremium ? "Premium PDF" : "PDF"}
                          </button>
                          {trip.share_code && (
                            <button
                              onClick={shareTripLink}
                              className="rahi-btn-primary px-4 py-2 text-sm"
                            >
                              <Share2 className="w-4 h-4" />
                              {trip.is_public === false ? "Private Share" : "Share"}
                            </button>
                          )}
                          {trip.id && (
                            <button
                              onClick={() => toggleTripVisibility()}
                              disabled={toggleLoading}
                              className="rahi-btn-secondary disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {trip.is_public === false ? (
                                <>
                                  <Lock className="w-4 h-4" /> Private
                                </>
                              ) : (
                                <>
                                  <Unlock className="w-4 h-4" /> Public
                                </>
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {plannerStage !== "build" && (
                    <div className="mb-5 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">
                            Planner Stage
                          </p>
                          <p className="text-sm text-white">
                            {STAGE_CONFIG[plannerStage].label}: {STAGE_CONFIG[plannerStage].hint}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="rahi-btn-ghost text-[11px]"
                            onClick={() => setPlannerStage("build")}
                          >
                            Edit Inputs
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {controlCenter && (
                    <div className="mb-5 rounded-xl border border-teal-500/30 bg-gradient-to-br from-teal-500/10 via-black/20 to-black/30 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-teal-200">
                            Trip Control Center
                          </p>
                          <p className="text-sm font-semibold text-white">
                            {controlCenter.statusLabel}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="rahi-btn-primary text-xs px-3 py-2 disabled:opacity-60"
                            onClick={() => void runDynamicReplan()}
                            disabled={!isPro || dynamicReplanning || loading || streaming}
                          >
                            {dynamicReplanning
                              ? "Replanning..."
                              : isPro
                                ? "Run Dynamic Replan"
                                : "Dynamic Replan (Pro)"}
                          </button>
                          <button
                            type="button"
                            className="rahi-btn-secondary text-xs px-3 py-2 disabled:opacity-60"
                            onClick={() => void runBudgetCopilot()}
                            disabled={
                              budgetCopilotRunning ||
                              !budgetCopilot?.canAutoTrim
                            }
                          >
                            {budgetCopilotRunning ? "Auto-trimming..." : "Run Budget Copilot"}
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-gray-400">
                            Health Score
                          </p>
                          <p className="text-lg font-bold text-white">{controlCenter.healthScore}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-gray-400">
                            Budget Delta
                          </p>
                          <p
                            className={`text-lg font-bold ${
                              controlCenter.budgetDelta > 0 ? "text-red-300" : "text-emerald-300"
                            }`}
                          >
                            {controlCenter.budgetDelta > 0 ? "+" : ""}
                            ₹{formatCurrency(Math.abs(controlCenter.budgetDelta))}
                          </p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-gray-400">
                            Weather Risk
                          </p>
                          <p className="text-lg font-bold text-white">
                            {controlCenter.weatherRiskCount
                              ? `${controlCenter.weatherRiskCount} day${controlCenter.weatherRiskCount > 1 ? "s" : ""}`
                              : "Low"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-gray-400">
                            Route Data
                          </p>
                          <p className="text-lg font-bold text-white">
                            {controlCenter.routeReady ? "Ready" : "Limited"}
                          </p>
                        </div>
                      </div>
                      {lastReplanSummary && (
                        <p className="mt-3 text-[11px] text-teal-200">{lastReplanSummary}</p>
                      )}
                    </div>
                  )}

                  {/* PDF Content Area */}
                  <div id="pdf-content" className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                      <div className="hidden pdf-only mb-6">
                        <h1 className="text-3xl font-bold">Rahi.AI Itinerary</h1>
                        <p>Trip to {destination}</p>
                      </div>

                      {/* Weather Section */}
                      {plannerStage === "optimize" && tripHealth && (
                        <details className={foldableShell}>
                          <summary className={foldableSummary}>
                            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-teal-300">
                              <ShieldCheck className="h-4 w-4" /> Trip Health
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  void autoFixTrip();
                                }}
                                disabled={!tripHealth.fixableDays.length || fixingTrip}
                                className="rahi-btn-ghost text-[10px] disabled:opacity-60"
                              >
                                {fixingTrip ? "Fixing..." : "Auto Fix"}
                              </button>
                              <ChevronDown className="h-4 w-4 text-gray-400 transition group-open:rotate-180" />
                            </div>
                          </summary>
                          <div className={foldableContent}>
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                              <div className="rounded-lg bg-black/20 p-3">
                                <p className="text-xs text-gray-400">Score</p>
                                <p className="text-lg font-bold text-white">{tripHealth.summary.score}</p>
                              </div>
                              <div className="rounded-lg bg-black/20 p-3">
                                <p className="text-xs text-gray-400">Missing spots</p>
                                <p className="text-lg font-bold text-white">{tripHealth.summary.missingLocations}</p>
                              </div>
                              <div className="rounded-lg bg-black/20 p-3">
                                <p className="text-xs text-gray-400">Duplicates</p>
                                <p className="text-lg font-bold text-white">{tripHealth.summary.duplicateActivities}</p>
                              </div>
                              <div className="rounded-lg bg-black/20 p-3">
                                <p className="text-xs text-gray-400">Budget</p>
                                <p className={`text-lg font-bold ${tripHealth.summary.budgetOver ? "text-red-300" : "text-white"}`}>
                                  {tripHealth.summary.budgetOver ? "Over" : "On track"}
                                </p>
                              </div>
                            </div>
                            {tripHealth.issues.length > 0 ? (
                              <div className="mt-3 space-y-2">
                                {tripHealth.issues.slice(0, 4).map((issue) => (
                                  <div
                                    key={issue.id}
                                    className="rounded-lg border border-white/5 bg-black/10 px-3 py-2 text-xs text-gray-400"
                                  >
                                    {issue.message}
                                  </div>
                                ))}
                                {tripHealth.issues.length > 4 && (
                                  <p className="text-[10px] text-gray-500">
                                    +{tripHealth.issues.length - 4} more issues detected.
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="mt-3 text-xs text-gray-400">Everything looks great. Ready to travel.</p>
                            )}
                          </div>
                        </details>
                      )}

                      {plannerStage === "optimize" && (
                      <details className={foldableShell}>
                        <summary className={foldableSummary}>
                          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-300">
                            <Sparkles className="w-4 h-4" /> Premium Intelligence
                          </div>
                          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-gray-400">
                            Insights
                            <ChevronDown className="h-4 w-4 text-gray-400 transition group-open:rotate-180" />
                          </div>
                        </summary>
                        <div className={foldableContent}>
                        {planCapabilities.premiumInsights ? (
                          <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="bg-black/20 p-3 rounded-lg">
                                <p className="text-xs text-gray-400">Avg / Day</p>
                                <p className="text-lg font-bold text-white">
                                  ₹{formatCurrency(premiumInsights?.avgPerDay || 0)}
                                </p>
                              </div>
                              <div className="bg-black/20 p-3 rounded-lg">
                                <p className="text-xs text-gray-400">Budget Delta</p>
                                <p
                                  className={`text-lg font-bold ${
                                    (premiumInsights?.budgetDelta || 0) > 0 ? "text-red-300" : "text-emerald-300"
                                  }`}
                                >
                                  {(premiumInsights?.budgetDelta || 0) > 0 ? "+" : ""}
                                  ₹{formatCurrency(Math.abs(premiumInsights?.budgetDelta || 0))}
                                </p>
                              </div>
                              <div className="bg-black/20 p-3 rounded-lg">
                                <p className="text-xs text-gray-400">Day Load</p>
                                <p className="text-lg font-bold text-white">
                                  {tripDaysCount || 0} days
                                </p>
                              </div>
                              <div className="bg-black/20 p-3 rounded-lg">
                                <p className="text-xs text-gray-400">Top Cost</p>
                                <p className="text-lg font-bold text-white">
                                  ₹{formatCurrency(premiumInsights?.expensiveActivity?.cost || 0)}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={optimizeTripRoutes}
                                disabled={
                                  !planCapabilities.routeOptimization ||
                                  !premiumInsights?.canOptimize ||
                                  optimizingRoutes
                                }
                                className="rahi-btn-secondary text-xs disabled:opacity-60"
                              >
                                {optimizingRoutes ? "Optimizing..." : "Optimize routes"}
                              </button>
                              <button
                                type="button"
                                onClick={swapExpensiveActivity}
                                disabled={
                                  !planCapabilities.activitySwap ||
                                  !premiumInsights?.expensiveActivity ||
                                  Boolean(replacingActivityId)
                                }
                                className="rahi-btn-ghost text-xs disabled:opacity-60"
                              >
                                Swap pricey stop {planCapabilities.activitySwap ? "" : "(Pro)"}
                              </button>
                            </div>
                            {lastReplanSummary && (
                              <p className="mt-2 text-[11px] text-teal-200">
                                {lastReplanSummary}
                              </p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-400">
                              {premiumInsights?.overloadedDays?.map((day) => (
                                <span key={`over-${day.day}`} className="px-2 py-1 rounded-full bg-red-500/10 text-red-200">
                                  Day {day.day}: {day.count} stops
                                </span>
                              ))}
                              {premiumInsights?.underloadedDays?.map((day) => (
                                <span key={`under-${day.day}`} className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-200">
                                  Day {day.day}: only {day.count} stops
                                </span>
                              ))}
                              {!premiumInsights?.overloadedDays?.length &&
                                !premiumInsights?.underloadedDays?.length && (
                                  <span className="px-2 py-1 rounded-full bg-white/5 text-emerald-200">
                                    Days are nicely balanced.
                                  </span>
                                )}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-gray-400">
                            Upgrade to Premium for route, budget, and pacing intelligence.
                          </div>
                        )}
                        </div>
                      </details>
                      )}

                      {plannerStage === "optimize" && (
                      <details className={foldableShell}>
                        <summary className={foldableSummary}>
                          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-300">
                            <IndianRupee className="w-4 h-4" /> Budget Copilot
                          </div>
                          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-gray-400">
                            Live guardrails
                            <ChevronDown className="h-4 w-4 text-gray-400 transition group-open:rotate-180" />
                          </div>
                        </summary>
                        <div className={foldableContent}>
                          {budgetCopilot ? (
                            <>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-black/20 p-3 rounded-lg">
                                  <p className="text-xs text-gray-400">Target</p>
                                  <p className="text-lg font-bold text-white">
                                    ₹{formatCurrency(budgetCopilot.targetBudget || 0)}
                                  </p>
                                </div>
                                <div className="bg-black/20 p-3 rounded-lg">
                                  <p className="text-xs text-gray-400">Current Spend</p>
                                  <p className="text-lg font-bold text-white">
                                    ₹{formatCurrency(budgetCopilot.currentSpend || 0)}
                                  </p>
                                </div>
                                <div className="bg-black/20 p-3 rounded-lg">
                                  <p className="text-xs text-gray-400">Delta</p>
                                  <p
                                    className={`text-lg font-bold ${
                                      budgetCopilot.budgetDelta > 0
                                        ? "text-red-300"
                                        : "text-emerald-300"
                                    }`}
                                  >
                                    {budgetCopilot.budgetDelta > 0 ? "+" : ""}
                                    ₹{formatCurrency(Math.abs(budgetCopilot.budgetDelta))}
                                  </p>
                                </div>
                                <div className="bg-black/20 p-3 rounded-lg">
                                  <p className="text-xs text-gray-400">Day Target</p>
                                  <p className="text-lg font-bold text-white">
                                    ₹{formatCurrency(budgetCopilot.dayTarget || 0)}
                                  </p>
                                </div>
                              </div>

                              {budgetCopilot.hasTargetBudget && (
                                <div className="mt-3">
                                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                                    <span>Budget pressure</span>
                                    <span>{Math.max(0, budgetCopilot.utilizationPercent)}%</span>
                                  </div>
                                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                                    <div
                                      className={`h-full transition-all ${
                                        budgetCopilot.utilizationPercent > 110
                                          ? "bg-red-400"
                                          : budgetCopilot.utilizationPercent > 95
                                            ? "bg-amber-300"
                                            : "bg-emerald-400"
                                      }`}
                                      style={{
                                        width: `${Math.min(
                                          100,
                                          Math.max(
                                            4,
                                            Math.round(
                                              (budgetCopilot.currentSpend /
                                                Math.max(budgetCopilot.targetBudget, 1)) *
                                                100
                                            )
                                          )
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              )}

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void runBudgetCopilot()}
                                  disabled={
                                    budgetCopilotRunning ||
                                    !budgetCopilot.canAutoTrim
                                  }
                                  className="rahi-btn-secondary text-xs disabled:opacity-60"
                                >
                                  {budgetCopilotRunning
                                    ? "Auto-trimming..."
                                    : budgetCopilot.canAutoTrim
                                      ? "Run Auto-Trim"
                                      : "Run Auto-Trim (Pro)"}
                                </button>
                                <button
                                  type="button"
                                  onClick={swapExpensiveActivity}
                                  disabled={
                                    !planCapabilities.activitySwap ||
                                    !premiumInsights?.expensiveActivity ||
                                    Boolean(replacingActivityId)
                                  }
                                  className="rahi-btn-ghost text-xs disabled:opacity-60"
                                >
                                  Swap top pricey stop {planCapabilities.activitySwap ? "" : "(Pro)"}
                                </button>
                              </div>

                              {budgetCopilot.focusDays.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                  {budgetCopilot.focusDays.map((day) => (
                                    <span
                                      key={`budget-focus-${day.day}`}
                                      className="rounded-full border border-red-400/30 bg-red-500/10 px-2 py-1 text-red-200"
                                    >
                                      Day {day.day}: ₹{formatCurrency(day.cost)}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="mt-3 space-y-2">
                                {budgetCopilot.recommendations.map((tip) => (
                                  <p
                                    key={tip}
                                    className="rounded-lg border border-white/5 bg-black/10 px-3 py-2 text-xs text-gray-300"
                                  >
                                    {tip}
                                  </p>
                                ))}
                              </div>

                              {lastBudgetCopilotSummary && (
                                <p className="mt-2 text-[11px] text-emerald-200">
                                  {lastBudgetCopilotSummary}
                                </p>
                              )}
                            </>
                          ) : (
                            <div className="text-xs text-gray-400">
                              Generate a plan to activate Budget Copilot.
                            </div>
                          )}
                        </div>
                      </details>
                      )}

                      {plannerStage === "share" && (
                      <details className={foldableShell}>
                        <summary className={foldableSummary}>
                          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-teal-400">
                            <Sparkles className="w-4 h-4" /> Rahi.AI Signature Plans
                          </div>
                          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-gray-400">
                            3-Plan Stack
                            <ChevronDown className="h-4 w-4 text-gray-400 transition group-open:rotate-180" />
                          </div>
                        </summary>
                        <div className={foldableContent}>
                        {planCapabilities.signaturePlans ? (
                          <div className="grid lg:grid-cols-3 gap-4">
                            <div className="bg-black/20 p-4 rounded-lg">
                              <div className="flex items-center gap-2 text-[11px] uppercase text-teal-200 font-semibold">
                                <Compass className="w-3 h-3" /> Plan 1 • Precision
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <div className="rounded-md bg-black/30 p-2">
                                  <p className="text-[10px] text-gray-400">Variety</p>
                                  <p className="text-sm font-bold text-white">
                                    {premiumInsights?.varietyScore ?? 0}%
                                  </p>
                                </div>
                                <div className="rounded-md bg-black/30 p-2">
                                  <p className="text-[10px] text-gray-400">Avg Hours/Day</p>
                                  <p className="text-sm font-bold text-white">
                                    {premiumInsights?.avgDuration
                                      ? (premiumInsights.avgDuration / 60).toFixed(1)
                                      : "0.0"}
                                    h
                                  </p>
                                </div>
                                <div className="rounded-md bg-black/30 p-2">
                                  <p className="text-[10px] text-gray-400">Distance</p>
                                  <p className="text-sm font-bold text-white">
                                    {premiumInsights?.totalDistanceKm ?? 0} km
                                  </p>
                                </div>
                                <div className="rounded-md bg-black/30 p-2">
                                  <p className="text-[10px] text-gray-400">Busiest</p>
                                  <p className="text-sm font-bold text-white">
                                    {premiumInsights?.busiestDay
                                      ? `Day ${premiumInsights.busiestDay.day}`
                                      : "—"}
                                  </p>
                                </div>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-2">
                                Flow tuned with distance + pace intelligence.
                              </p>
                            </div>

                            <div className="bg-black/20 p-4 rounded-lg">
                              <div className="flex items-center gap-2 text-[11px] uppercase text-teal-200 font-semibold">
                                <ClipboardCheck className="w-3 h-3" /> Plan 2 • Concierge
                              </div>
                              <div className="mt-3 space-y-2">
                                {PREMIUM_CHECKLIST.map((item) => (
                                  <label key={item.id} className="flex items-center gap-2 text-xs text-gray-300">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 accent-teal-400"
                                      checked={prepChecklist[item.id] ?? false}
                                      onChange={(e) =>
                                        setPrepChecklist((prev) => ({
                                          ...prev,
                                          [item.id]: e.target.checked,
                                        }))
                                      }
                                    />
                                    <span className={prepChecklist[item.id] ? "line-through text-gray-500" : ""}>
                                      {item.label}
                                    </span>
                                  </label>
                                ))}
                              </div>
                              {packingSuggestions.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1">
                                  {packingSuggestions.map((item) => (
                                    <span
                                      key={item}
                                      className="px-2 py-1 rounded-full text-[10px] bg-teal-500/10 border border-teal-400/20 text-teal-100"
                                    >
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="bg-black/20 p-4 rounded-lg">
                              <div className="flex items-center gap-2 text-[11px] uppercase text-teal-200 font-semibold">
                                <PenLine className="w-3 h-3" /> Plan 3 • Story
                              </div>
                              <p className="mt-3 text-xs text-gray-300 leading-relaxed">
                                {signatureStory || "Generate a plan to unlock a shareable story."}
                              </p>
                              <button
                                type="button"
                                onClick={() => copyTripStory(signatureStory)}
                                disabled={!signatureStory}
                                className="mt-3 rahi-btn-secondary text-xs disabled:opacity-60"
                              >
                                Copy story
                              </button>
                              <button
                                type="button"
                                onClick={refineTripStory}
                                disabled={storyLoading || !trip}
                                className="mt-2 rahi-btn-ghost text-xs disabled:opacity-60"
                              >
                                {storyLoading ? "Refining..." : "Refine with AI"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400">
                            Upgrade to Premium to unlock Rahi.AI Signature Plans.
                          </div>
                        )}
                        </div>
                      </details>
                      )}

                      {plannerStage === "optimize" && (weather.length > 0 || weatherLoading || weatherError) && (
                        <details className={foldableShell}>
                          <summary className={foldableSummary}>
                            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-teal-400">
                              <CloudSun className="w-4 h-4" /> Forecast
                            </div>
                            <ChevronDown className="h-4 w-4 text-gray-400 transition group-open:rotate-180" />
                          </summary>
                          <div className={foldableContent}>
                          {weatherLoading && (
                            <div className="text-xs text-gray-400">Fetching weather...</div>
                          )}
                          {!weatherLoading && weatherError && (
                            <div className="text-xs text-red-300">{weatherError}</div>
                          )}
                          {!weatherLoading && !weatherError && weather.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {weather.map((w, i) => (
                                <div key={i} className="bg-black/20 p-3 rounded-lg text-center">
                                   <p className="text-xs text-gray-500 mb-1">Day {i + 1}</p>
                                   <p className="text-lg font-bold text-white">{Math.round(w.main?.temp || 0)}°C</p>
                                   <p className="text-[10px] text-gray-400 capitalize truncate">{w.weather?.[0]?.description}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {!weatherLoading && !weatherError && weather.length === 0 && (
                            <div className="text-xs text-gray-400">Weather data not available yet.</div>
                          )}
                          </div>
                        </details>
                      )}

                      {plannerStage === "share" && pdfIsPremium && (
                        <details className={foldableShell}>
                          <summary className={foldableSummary}>
                            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-teal-400">
                              <Sparkles className="w-4 h-4" /> Premium PDF Studio
                            </div>
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-gray-400">
                              Theme
                              <ChevronDown className="h-4 w-4 text-gray-400 transition group-open:rotate-180" />
                            </div>
                          </summary>
                          <div className={foldableContent}>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setPdfThemeOverride(null)}
                              className={`px-3 py-1 rounded-full text-[11px] border transition ${
                                !pdfThemeOverride
                                  ? "border-teal-400/60 bg-teal-500/20 text-teal-100"
                                  : "border-white/10 text-gray-300 hover:border-teal-400/40"
                              }`}
                            >
                              Auto • {autoCoverThemeLabel}
                            </button>
                            {Object.entries(coverThemeLabels).map(([key, label]) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setPdfThemeOverride(key)}
                                className={`px-3 py-1 rounded-full text-[11px] border transition ${
                                  pdfThemeOverride === key
                                    ? "border-teal-400/60 bg-teal-500/20 text-teal-100"
                                    : "border-white/10 text-gray-300 hover:border-teal-400/40"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-2">
                            Applies to the PDF cover art, palette, and premium visuals.
                          </p>
                          </div>
                        </details>
                      )}

                      {plannerStage === "optimize" && (
                      <details open className={foldableShell}>
                        <summary className={foldableSummary}>
                          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-teal-400">
                            <MapPin className="w-4 h-4" /> Trip Map
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                trip.destination
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className="rahi-btn-ghost text-[10px]"
                            >
                              Open Map
                            </a>
                            <ChevronDown className="h-4 w-4 text-gray-400 transition group-open:rotate-180" />
                          </div>
                        </summary>
                        <div className={foldableContent}>
                          <TripMap
                            destination={trip.destination}
                            stops={mapStops}
                            mapboxToken={mapboxToken}
                            premium={planCapabilities.premiumInsights}
                          />
                          {mapEnriching && (
                            <p className="mt-2 text-xs text-gray-400">Enhancing map locations...</p>
                          )}
                          {mapStops.length === 0 && (
                            <p className="mt-3 text-xs text-gray-400">Add locations or regenerate for map pins.</p>
                          )}
                        </div>
                      </details>
                      )}

                      {plannerStage === "optimize" && stayFit && (
                        <details className={foldableShell}>
                          <summary className={foldableSummary}>
                            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-teal-400">
                              <Compass className="w-4 h-4" /> Stay Fit Score
                            </div>
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-gray-400">
                              Non-booking
                              <ChevronDown className="h-4 w-4 text-gray-400 transition group-open:rotate-180" />
                            </div>
                          </summary>
                          <div className={foldableContent}>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-black/20 p-3 rounded-lg">
                              <p className="text-xs text-gray-400">Score</p>
                              <p
                                className={`text-lg font-bold ${
                                  stayFit.score >= 80
                                    ? "text-emerald-300"
                                    : stayFit.score >= 60
                                      ? "text-teal-300"
                                      : "text-amber-300"
                                }`}
                              >
                                {stayFit.score}
                              </p>
                            </div>
                            <div className="bg-black/20 p-3 rounded-lg">
                              <p className="text-xs text-gray-400">Budget / Day</p>
                              <p className="text-lg font-bold text-white">
                                ₹{formatCurrency(stayFit.budgetPerDay)}
                              </p>
                            </div>
                            <div className="bg-black/20 p-3 rounded-lg">
                              <p className="text-xs text-gray-400">Pace</p>
                              <p className="text-lg font-bold text-white capitalize">
                                {stayFit.pace}
                              </p>
                            </div>
                            <div className="bg-black/20 p-3 rounded-lg">
                              <p className="text-xs text-gray-400">Trip Distance</p>
                              <p className="text-lg font-bold text-white">
                                {premiumInsights?.totalDistanceKm ?? 0} km
                              </p>
                              <p className="text-[10px] text-gray-500 mt-1">
                                {stayFit.commuteTip}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 grid md:grid-cols-2 gap-3">
                            <div className="bg-black/20 p-3 rounded-lg">
                              <p className="text-xs text-gray-400">Where to stay</p>
                              <div className="mt-2 space-y-1">
                                {stayFit.areaTips.map((tip) => (
                                  <p key={tip} className="text-xs text-gray-300">
                                    • {tip}
                                  </p>
                                ))}
                              </div>
                            </div>
                            <div className="bg-black/20 p-3 rounded-lg">
                              <p className="text-xs text-gray-400">Budget guidance</p>
                              <p className="mt-2 text-xs text-gray-300">
                                {stayFit.budgetGuide}
                              </p>
                            </div>
                          </div>
                          </div>
                        </details>
                      )}

                      {plannerStage === "optimize" && trip?.days?.length > 0 && (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-teal-400 font-bold text-sm uppercase tracking-wide">
                              <Settings className="w-4 h-4" /> Day-of Optimization
                            </div>
                            <span className="text-[10px] text-gray-400 uppercase tracking-[0.18em]">
                              Live adjustments
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex flex-wrap gap-2">
                              {trip.days.map((day) => (
                                <button
                                  key={day.day_number}
                                  type="button"
                                  onClick={() => setSelectedDay(day.day_number)}
                                  className={`rahi-btn-ghost text-[10px] ${
                                    selectedDay === day.day_number
                                      ? "border border-teal-500/40 bg-teal-500/10 text-teal-300"
                                      : "text-gray-400"
                                  }`}
                                >
                                  Day {day.day_number}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => optimizeDayPlan(selectedDay)}
                              disabled={
                                !planCapabilities.dayOptimization ||
                                optimizingDay ||
                                loading ||
                                streaming
                              }
                              className="rahi-btn-secondary text-xs px-4 py-2 disabled:opacity-60"
                            >
                              {optimizingDay
                                ? "Optimizing..."
                                : planCapabilities.dayOptimization
                                  ? "Optimize day"
                                  : "Optimize day (Pro)"}
                            </button>
                            <span className="text-[11px] text-gray-500">
                              Uses travel time + weather
                            </span>
                          </div>
                          {weatherRiskDays.length > 0 && (
                            <p className="text-[11px] text-amber-200 mt-2">
                              Weather risk detected on day{" "}
                              {weatherRiskDays.join(", ")}. Use Dynamic Replan for auto-adjustments.
                            </p>
                          )}
                          <p className="text-[11px] text-gray-500 mt-2">
                            {selectedDayWeather?.weather?.[0]?.description
                              ? `Weather: ${selectedDayWeather.weather[0].description}`
                              : "Add weather data for smarter ordering."}
                          </p>
                        </div>
                      )}

                      {plannerStage === "share" && trip && (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-teal-400 font-bold text-sm uppercase tracking-wide">
                              <MessageSquare className="w-4 h-4" /> Group Coordination
                            </div>
                            <span className="text-[10px] text-gray-400 uppercase tracking-[0.18em]">
                              Local only
                            </span>
                          </div>
                          <div className="grid md:grid-cols-3 gap-3">
                            <div className="bg-black/20 p-3 rounded-lg">
                              <p className="text-xs text-gray-400">Members & Split</p>
                              <div className="mt-2 flex gap-2">
                                <input
                                  className="rahi-input px-3 py-2 text-xs"
                                  placeholder="Add member"
                                  value={groupMemberInput}
                                  onChange={(e) => setGroupMemberInput(e.target.value)}
                                />
                                <button
                                  type="button"
                                  onClick={addGroupMember}
                                  className="rahi-btn-secondary text-xs px-3 py-2"
                                >
                                  Add
                                </button>
                              </div>
                              <div className="mt-3 space-y-2">
                                {groupMembers.length > 0 ? (
                                  groupMembers.map((member) => (
                                    <div
                                      key={member}
                                      className="flex items-center justify-between text-xs text-gray-300"
                                    >
                                      <span>{member}</span>
                                      <button
                                        type="button"
                                        onClick={() => removeGroupMember(member)}
                                        className="text-[10px] text-red-300"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-[11px] text-gray-500">
                                    Add members to split the budget.
                                  </p>
                                )}
                              </div>
                              <div className="mt-3 text-xs text-gray-300">
                                Total: ₹{formatCurrency(groupBudgetTotal)}
                              </div>
                              <div className="text-xs text-gray-300">
                                Per person: ₹{formatCurrency(groupPerPerson)}
                              </div>
                            </div>

                            <div className="bg-black/20 p-3 rounded-lg">
                              <p className="text-xs text-gray-400">Polls</p>
                              <div className="mt-2 space-y-2">
                                <input
                                  className="rahi-input px-3 py-2 text-xs"
                                  placeholder="Poll question"
                                  value={pollQuestion}
                                  onChange={(e) => setPollQuestion(e.target.value)}
                                />
                                <input
                                  className="rahi-input px-3 py-2 text-xs"
                                  placeholder="Options (comma separated)"
                                  value={pollOptionsInput}
                                  onChange={(e) => setPollOptionsInput(e.target.value)}
                                />
                                <button
                                  type="button"
                                  onClick={addGroupPoll}
                                  className="rahi-btn-secondary text-xs px-3 py-2"
                                >
                                  Create poll
                                </button>
                              </div>
                              <div className="mt-3 space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                                {groupPolls.length > 0 ? (
                                  groupPolls.map((poll) => (
                                    <div
                                      key={poll.id}
                                      className="border border-white/10 rounded-lg p-2"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="text-xs text-white">{poll.question}</p>
                                        <button
                                          type="button"
                                          onClick={() => removeGroupPoll(poll.id)}
                                          className="text-[10px] text-gray-500"
                                        >
                                          Clear
                                        </button>
                                      </div>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {poll.options.map((option) => (
                                          <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => voteGroupPoll(poll.id, option.id)}
                                            className="rahi-btn-ghost text-[10px]"
                                          >
                                            {option.label} • {option.votes}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-[11px] text-gray-500">
                                    Create a poll to decide together.
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="bg-black/20 p-3 rounded-lg">
                              <p className="text-xs text-gray-400">Decision Tracker</p>
                              <div className="mt-2 flex gap-2">
                                <input
                                  className="rahi-input px-3 py-2 text-xs"
                                  placeholder="Add decision"
                                  value={decisionInput}
                                  onChange={(e) => setDecisionInput(e.target.value)}
                                />
                                <button
                                  type="button"
                                  onClick={addGroupDecision}
                                  className="rahi-btn-secondary text-xs px-3 py-2"
                                >
                                  Add
                                </button>
                              </div>
                              <div className="mt-3 space-y-2">
                                {groupDecisions.length > 0 ? (
                                  groupDecisions.map((decision) => (
                                    <label
                                      key={decision.id}
                                      className="flex items-center gap-2 text-xs text-gray-300"
                                    >
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 accent-teal-400"
                                        checked={decision.done}
                                        onChange={() => toggleGroupDecision(decision.id)}
                                      />
                                      <span
                                        className={
                                          decision.done
                                            ? "line-through text-gray-500"
                                            : ""
                                        }
                                      >
                                        {decision.text}
                                      </span>
                                    </label>
                                  ))
                                ) : (
                                  <p className="text-[11px] text-gray-500">
                                    Track key decisions here.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {trip.days && Array.isArray(trip.days) ? (
                        <TripItinerary
                          trip={trip}
                          onRegenerateDay={loading || streaming ? undefined : regenerateDay}
                          onReplaceActivity={loading || streaming ? undefined : replaceActivity}
                          onReorderActivity={loading || streaming ? undefined : reorderActivities}
                          loadingDay={regeneratingDay}
                          loadingActivityId={replacingActivityId}
                        />
                      ) : (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm">
                           ⚠️ Format error: This trip data is not in the correct JSON format. Please regenerate.
                        </div>
                      )}
                      
                      {streaming && (
                        <div className="flex items-center justify-center gap-2 py-4 text-teal-400 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce"></span>
                          <span className="text-sm font-mono">Rahi is planning the next day...</span>
                        </div>
                      )}
                  </div>
                </>
              )}
            </motion.div>

          </div>
        )}
      </div>

      {/* PDF EXPORT TEMPLATE */}
      <div
        className={`pdf-export ${pdfIsPremium ? "pdf-premium" : "pdf-free"} ${pdfDebug ? "pdf-debug" : ""}`}
        id="pdf-export"
      >
        <div className={`pdf-page pdf-cover pdf-cover-theme-${activeCoverTheme}`}>
          <div className="pdf-cover-art" aria-hidden="true">
            <div className="pdf-cover-art-orb" />
            <div className="pdf-cover-art-wave" />
            <div className="pdf-cover-art-dot" />
          </div>
          <div className="pdf-cover-photo" aria-hidden="true" />
          <div className="pdf-cover-content">
            <div className="pdf-cover-top">
              <div className="pdf-brand">Rahi.AI</div>
              <div className="pdf-flag">{pdfIsPremium ? "Premium" : "Free"}</div>
            </div>
            <div className="pdf-cover-title">Personal Trip Dossier</div>
            <div className="pdf-cover-destination">{pdfTrip.destination}</div>
            <div className="pdf-cover-theme">{coverThemeLabel}</div>
            <div className="pdf-cover-meta">
              <span>{pdfTrip.days.length || tripDaysCount} Days</span>
              <span>Budget: ₹{formatCurrency(displayBudget || 0)}</span>
              <span>{new Date().toLocaleDateString("en-IN")}</span>
            </div>
          </div>
          {!pdfIsPremium && (
            <div className="pdf-watermark">Rahi.AI FREE PLAN</div>
          )}
        </div>

        <div className="pdf-page">
          <div className="pdf-section">
            <div className="pdf-section-title">Trip Scope</div>
            <div className="pdf-grid">
              <div className="pdf-card">
                <div className="pdf-card-label">Destination</div>
                <div className="pdf-card-value">{pdfTrip.destination}</div>
              </div>
              <div className="pdf-card">
                <div className="pdf-card-label">Duration</div>
                <div className="pdf-card-value">
                  {pdfTrip.days.length || tripDaysCount} days
                </div>
              </div>
              <div className="pdf-card">
                <div className="pdf-card-label">Budget</div>
                <div className="pdf-card-value">
                  ₹{formatCurrency(displayBudget || 0)}
                </div>
              </div>
              <div className="pdf-card">
                <div className="pdf-card-label">Interests</div>
                <div className="pdf-card-value">{pdfInterests}</div>
              </div>
              {pdfTrip.meta?.pace && (
                <div className="pdf-card">
                  <div className="pdf-card-label">Pace</div>
                  <div className="pdf-card-value">{pdfTrip.meta.pace}</div>
                </div>
              )}
              {Array.isArray(pdfTrip.meta?.primary_vibes) && pdfTrip.meta!.primary_vibes!.length > 0 && (
                <div className="pdf-card">
                  <div className="pdf-card-label">Primary Vibes</div>
                  <div className="pdf-card-value">
                    {pdfTrip.meta?.primary_vibes?.join(", ")}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pdf-section">
            <div className="pdf-section-title">Top Highlights</div>
            <div className="pdf-highlight-grid">
              {pdfHighlights.length > 0 ? (
                pdfHighlights.map((activity) => (
                  <div key={activity.id} className="pdf-highlight">
                    <div className="pdf-highlight-title">{activity.title}</div>
                    <div className="pdf-highlight-sub">
                      {activity.location?.name || "Unknown location"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="pdf-empty">Generate a trip to see highlights.</div>
              )}
            </div>
          </div>

          {pdfIsPremium ? (
            <div className="pdf-section">
              <div className="pdf-section-title">Budget Breakdown</div>
              <div className="pdf-budget">
                {pdfBudgetBreakdown.map((item) => {
                  const percent = pdfBudgetTotal
                    ? Math.round((item.value / pdfBudgetTotal) * 100)
                    : 0;
                  return (
                    <div key={item.label} className="pdf-budget-row">
                      <div className="pdf-budget-label">{item.label}</div>
                      <div className="pdf-budget-bar">
                        <div
                          className="pdf-budget-fill"
                          style={{ width: `${percent}%`, background: item.color }}
                        />
                      </div>
                      <div className="pdf-budget-meta">
                        ₹{formatCurrency(item.value)} • {percent}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="pdf-section">
              <div className="pdf-section-title">Budget Snapshot</div>
              <div className="pdf-budget-basic">
                <div className="pdf-budget-ring" aria-hidden="true">
                  <div className="pdf-budget-ring-inner">
                    <div className="pdf-budget-ring-value">
                      ₹{formatCurrency(displayBudget || 0)}
                    </div>
                    <div className="pdf-budget-ring-label">Total Budget</div>
                  </div>
                </div>
                <div className="pdf-budget-summary">
                  <div className="pdf-budget-total">
                    Avg / Day: ₹{formatCurrency(
                      Math.round((displayBudget || 0) / Math.max(tripDaysCount || 1, 1))
                    )}
                  </div>
                  <div className="pdf-budget-note">
                    Upgrade to Premium for detailed breakdowns, packing essentials, and QR sharing.
                  </div>
                </div>
              </div>
            </div>
          )}

          {pdfIsPremium && (
            <div className="pdf-section">
              <div className="pdf-section-title">Packing Essentials</div>
              <div className="pdf-packing">
                {pdfPacking.map((item) => (
                  <div key={item} className="pdf-packing-item">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {pdfIsPremium && (
          <div className="pdf-page">
            <div className="pdf-section">
              <div className="pdf-section-title">Signature Plans</div>
              <div className="pdf-signature-grid">
                <div className="pdf-signature-card">
                  <div className="pdf-signature-label">Plan 1 • Precision</div>
                  <div className="pdf-signature-metric">
                    Variety {premiumInsights?.varietyScore ?? 0}%
                  </div>
                  <div className="pdf-signature-metric">
                    Avg {premiumInsights?.avgDuration ? (premiumInsights.avgDuration / 60).toFixed(1) : "0.0"}h/day
                  </div>
                  <div className="pdf-signature-metric">
                    Distance {premiumInsights?.totalDistanceKm ?? 0} km
                  </div>
                </div>
                <div className="pdf-signature-card">
                  <div className="pdf-signature-label">Plan 2 • Concierge</div>
                  <div className="pdf-signature-list">
                    {pdfChecklist.slice(0, 4).map((item) => (
                      <div
                        key={item.id}
                        className={`pdf-signature-item ${item.done ? "is-done" : ""}`}
                      >
                        {item.done ? "✓" : "•"} {item.label}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pdf-signature-card">
                  <div className="pdf-signature-label">Plan 3 • Story</div>
                  <div className="pdf-signature-story">
                    {signatureStory || "Generate a trip to unlock the story."}
                  </div>
                </div>
              </div>
            </div>
            <div className="pdf-section">
              <div className="pdf-section-title pdf-section-title-lg">Journey Timeline</div>
              {pdfTrip.days.length > 0 ? (
                <div className="pdf-timeline">
                  {pdfTrip.days.map((day) => {
                    const dayCost = day.activities.reduce(
                      (sum, activity) => sum + (Number(activity.estimated_cost) || 0),
                      0
                    );
                    return (
                      <div key={day.day_number} className="pdf-timeline-item">
                        <div>
                          <div className="pdf-timeline-day">Day {day.day_number}</div>
                          <div className="pdf-timeline-title">
                            {day.summary || "Signature experiences"}
                          </div>
                          <div className="pdf-timeline-list">
                            {day.activities.slice(0, 3).map((activity) => (
                              <span key={activity.id} className="pdf-timeline-pill">
                                {activity.title}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="pdf-timeline-meta">
                          <div>{day.activities.length} stops</div>
                          <div>₹{formatCurrency(dayCost)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="pdf-empty">Generate a trip to see timeline.</div>
              )}
            </div>
            <div className="pdf-section">
              <div className="pdf-section-title">Route Snapshot</div>
              {pdfMapUrl ? (
                <div className="pdf-map">
                  <img
                    src={pdfMapUrl}
                    alt="Trip map snapshot"
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="pdf-empty">
                  Map snapshot will appear once locations are available.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pdf-page">
          <div className="pdf-section-title">Day-by-Day Plan</div>
          {pdfTrip.days.length > 0 ? (
            pdfTrip.days.map((day) => (
              <div key={day.day_number} className="pdf-day">
                <div className="pdf-day-header">
                  <div>Day {day.day_number}</div>
                  {day.summary && <div className="pdf-day-summary">{day.summary}</div>}
                </div>
                <div className="pdf-day-body">
                  {day.activities.map((activity) => (
                    <div key={activity.id} className="pdf-activity">
                      <div className="pdf-activity-title">{activity.title}</div>
                      <div className="pdf-activity-meta">
                        {activity.location?.name || "Unknown"} • ₹{formatCurrency(activity.estimated_cost)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="pdf-empty">No itinerary available yet.</div>
          )}
        </div>

        <div className="pdf-page">
          <div className="pdf-section-title pdf-section-title-lg">Weather Snapshot</div>
          <div className="pdf-weather-grid">
            {weather.length > 0 ? (
              weather.slice(0, 6).map((w, i) => (
                <div key={i} className="pdf-weather-card">
                  <div className="pdf-weather-day">Day {i + 1}</div>
                  <div className="pdf-weather-temp">{Math.round(w.main?.temp || 0)}°C</div>
                  <div className="pdf-weather-desc">{w.weather?.[0]?.description || "Clear"}</div>
                </div>
              ))
            ) : weatherLoading ? (
              <div className="pdf-empty">Fetching weather...</div>
            ) : weatherError ? (
              <div className="pdf-empty">{weatherError}</div>
            ) : (
              <div className="pdf-empty">Weather data will appear after generation.</div>
            )} 
          </div>

          <div className="pdf-section pdf-share-section">
            <div className="pdf-section-title">Share & Access</div>
            <div className="pdf-share-card">
              <div className="pdf-share-info">
                <div className="pdf-card-label">Trip link</div>
                <div className="pdf-share-url">
                  {shareUrl ||
                    (isPrivateTrip
                      ? "Private link will appear once the trip is saved."
                      : "Set trip to public to generate a share link.")}
                </div>
                <div className="pdf-share-note">
                  {pdfIsPremium
                    ? isPrivateTrip
                      ? "Private link: only invited members can open this trip."
                      : "Scan the QR on mobile for instant access."
                    : "Upgrade for a scannable QR card."}
                </div>
              </div>
              <div className="pdf-share-qr">
                {pdfIsPremium && shareUrl && qrDataUrl ? (
                  <img src={qrDataUrl} alt="Trip QR code" />
                ) : (
                  <div className="pdf-qr-placeholder">
                    {!shareUrl
                      ? isPrivateTrip
                        ? "Save the trip to enable a private QR."
                        : "Make trip public to enable QR."
                      : pdfIsPremium
                        ? "Generating QR..."
                        : "QR available on Premium"}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pdf-footer">
            {shareUrl
              ? `Generated by Rahi.AI • ${isPrivateTrip ? "Private link" : "Share link"} • ${shareUrl}`
              : `Generated by Rahi.AI • ${
                  isPrivateTrip
                    ? "Private link available once trip is saved."
                    : "Share link available when trip is public."
                }`}
          </div>
        </div>
      </div>

      {upiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rahi-panel p-6">
            <h3 className="text-xl font-display font-bold text-white">Premium UPI Checkout</h3>
            <p className="text-sm text-gray-400 mt-2">
              Pay ₹{formatCurrency(Number.isFinite(upiPlanAmount) ? upiPlanAmount : 99)} via UPI and then confirm status to unlock Premium.
            </p>

            <div className="mt-4 space-y-3">
              <button
                onClick={() => void startUpgrade()}
                disabled={billingLoading}
                className="rahi-btn-primary w-full py-3 disabled:opacity-60"
              >
                {billingLoading ? "Creating UPI link..." : upiPaymentId ? "Create fresh UPI link" : "Pay now with UPI"}
              </button>

              <button
                onClick={() => void checkUpiStatus()}
                disabled={upiStatus === "checking" || !upiPaymentId}
                className="rahi-btn-secondary w-full py-3 disabled:opacity-60"
              >
                {upiStatus === "checking" ? "Checking..." : "Check status"}
              </button>

              {upiPaymentId && (
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-gray-400">Payment reference</p>
                  <input
                    value={upiPaymentId}
                    onChange={(event) => setUpiPaymentId(event.target.value)}
                    className="mt-1 w-full bg-transparent text-xs text-gray-200 outline-none"
                  />
                </div>
              )}

              {upiStatus === "pending" && (
                <p className="text-xs text-amber-200">
                  Waiting for payment completion. Finish payment in your UPI app, then click Check status.
                </p>
              )}

              {upiStatus === "paid" && (
                <p className="text-sm text-teal-300">Payment verified. Premium is active.</p>
              )}

              {upiStatus === "error" && (
                <p className="text-xs text-red-300">{upiError || "Unable to verify payment right now."}</p>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                className="rahi-btn-secondary text-sm"
                onClick={() => {
                  setUpiOpen(false);
                  setUpiStatus((prev) => (prev === "paid" ? prev : "idle"));
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {waitlistOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rahi-panel p-6">
            <h3 className="text-xl font-display font-bold text-white">Premium UPI Access</h3>
            <p className="text-sm text-gray-400 mt-2">
              UPI billing is coming soon. Join the waitlist and we’ll notify you first.
            </p>

            <div className="mt-4 space-y-3">
              <input
                className="rahi-input"
                placeholder="you@example.com"
                value={waitlistEmail}
                onChange={(e) => setWaitlistEmail(e.target.value)}
              />
              {waitlistStatus === "success" ? (
                <p className="text-sm text-teal-300">You’re on the list. We’ll reach out soon.</p>
              ) : (
                <button
                  onClick={submitWaitlist}
                  disabled={waitlistStatus === "loading"}
                  className="rahi-btn-primary w-full py-3 disabled:opacity-60"
                >
                  {waitlistStatus === "loading" ? "Submitting..." : "Join waitlist"}
                </button>
              )}
              {waitlistStatus === "error" && (
                <p className="text-xs text-red-300">Couldn’t save your email. Try again.</p>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                className="rahi-btn-secondary text-sm"
                onClick={() => {
                  setWaitlistOpen(false);
                  setWaitlistStatus("idle");
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </main>
  );
}

// All Perfect
