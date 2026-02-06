"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import RahiVoiceUI, { speakWithHeart } from "@/components/RahiVoiceUI";
import TripItinerary from "@/components/trips/TripItinerary";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MapPin, Calendar, IndianRupee, Compass, Send, 
  Download, Share2, Trash2, History, CloudSun,
  Plane, Sparkles, MessageSquare, Lock, Unlock,
  ClipboardCheck, PenLine,
  Settings, ShieldCheck
} from "lucide-react"; 
import RahiBackground from "@/components/RahiBackground";
import ThemeToggle from "@/components/ThemeToggle";

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

// --- TYPES ---

type Location = {
  name: string;
  lat?: number;
  lng?: number;
  coordinates?: [number, number];
};

type Activity = {
  id: string;
  title: string;
  location: Location;
  estimated_cost: number;
  order_index: number;
  type?: string;
  duration_minutes?: number;
  tags?: string[];
  verification?: string;
};

type DayPlan = {
  day_number: number;
  activities: Activity[];
  summary?: string;
};

type DayStat = {
  day: number;
  count: number;
  cost: number;
  duration: number;
  distance: number;
};

type TripMeta = {
  total_estimated_budget: number;
  pace?: "relaxed" | "balanced" | "packed";
  primary_vibes?: string[];
  packing_suggestions?: string[];
  prep_checklist?: Record<string, boolean>;
  signature_story?: string;
};

// Full Trip Structure
type Trip = {
  id?: string;
  destination: string;
  days: DayPlan[];
  meta: TripMeta;
  share_code?: string;
  is_public?: boolean;
};

type SavedTrip = {
  destination: string;
  daysInput: string;
  budgetInput: string;
  interestsInput: string;
  tripData: Trip;
  time: number;
};

type WeatherItem = {
  main?: { temp?: number };
  weather?: { description?: string }[];
};

type VoiceSettings = {
  tts: boolean;
  earcons: boolean;
  autoSend: boolean;
  lang: "en-IN" | "hi-IN";
};

export default function PlannerPage() {
  const router = useRouter();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  const [searchParams, setSearchParams] = useState(() => new URLSearchParams());

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
  const [formError, setFormError] = useState<string | null>(null);
  
  // History & Context
  const [history, setHistory] = useState<SavedTrip[]>([]);
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
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const [regeneratingDay, setRegeneratingDay] = useState<number | null>(null);
  const [replacingActivityId, setReplacingActivityId] = useState<string | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [fixingTrip, setFixingTrip] = useState(false);
  const [mapEnriching, setMapEnriching] = useState(false);
  const [optimizingRoutes, setOptimizingRoutes] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistStatus, setWaitlistStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [prepChecklist, setPrepChecklist] = useState<Record<string, boolean>>({});
  const [storyLoading, setStoryLoading] = useState(false);
  const [pdfThemeOverride, setPdfThemeOverride] = useState<string | null>(null);
  const premiumEnabled = process.env.NEXT_PUBLIC_PREMIUM_ENABLED === "true";
  const geocodeCacheRef = useRef(new Map<string, [number, number]>());
  const geocodeRunRef = useRef<string | null>(null);
  const checklistSaveRef = useRef<number | null>(null);

  const parseBudget = (value: string) => {
    const cleaned = value.replace(/,/g, "").trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const formatCurrency = (value: number) => {
    if (!Number.isFinite(value)) return "0";
    return value.toLocaleString("en-IN");
  };

  const getActivityCoord = (activity: Activity) => {
    const coord = activity.location?.coordinates;
    if (Array.isArray(coord) && coord.length === 2) {
      return coord as [number, number];
    }
    const lat = Number(activity.location?.lat ?? NaN);
    const lng = Number(activity.location?.lng ?? NaN);
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
      return [lng, lat] as [number, number];
    }
    return null;
  };

  const haversineKm = (from: [number, number], to: [number, number]) => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const [lng1, lat1] = from;
    const [lng2, lat2] = to;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 6371 * c;
  };

  const computeTotalBudget = (days: DayPlan[]) => {
    return days.reduce((sum, day) => {
      const dayTotal = day.activities.reduce(
        (acc, activity) => acc + (Number(activity.estimated_cost) || 0),
        0
      );
      return sum + dayTotal;
    }, 0);
  };

  const applyBudgetToTrip = (inputTrip: Trip) => {
    const total = computeTotalBudget(inputTrip.days);
    return {
      ...inputTrip,
      meta: {
        ...inputTrip.meta,
        total_estimated_budget: total,
      },
    };
  };

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

  const parseApiError = async (res: Response) => {
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
  };

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
    }, 2500);
  };

  const shareTripLink = () => {
    if (!trip?.share_code) {
      showToast("Share link not available yet.");
      return;
    }
    if (trip.is_public === false && !pdfIsPremium) {
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

  const startUpgrade = async () => {
    if (billingLoading) return;
    setBillingLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
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

  const TYPE_HINTS: Record<string, string> = {
    solo: "Best for solo exploration & flexibility.",
    college: "Fun, affordable & group-friendly trips.",
    family: "Comfort-focused family planning.",
    adventure: "Thrill & activity focused journeys.",
    budget: "Maximum value in minimum spend.",
  };

  const plannerMode = (mode || "ai") as keyof typeof MODE_CONFIG;
  const tripType = (type || "general") as keyof typeof TYPE_HINTS;
  const premiumPreview = searchParams.get("premium") === "1";
  const pdfIsPremium = isPremium || premiumPreview;
  const pdfDebug = searchParams.get("pdfdebug") === "1";
  const premiumEase = [0.16, 1, 0.3, 1] as const;

  // --- EFFECTS ---

  // Next 16 requires useSearchParams() to be wrapped in Suspense. Since this page is fully client-side,
  // we read query params from window after mount to keep builds/prerender stable.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setSearchParams(new URLSearchParams(window.location.search));
  }, []);

  // 🔐 AUTH GUARD
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.replace("/login");
      else setCheckingAuth(false);
    };
    checkSession();
  }, [router]);

  // Scroll chat to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, typing]);

  // Load history
  useEffect(() => {
    const data = localStorage.getItem("trip_history");
    if (data) {
      try {
        const parsed = JSON.parse(data) as SavedTrip[];
        const normalized = parsed.map((entry) => ({
          ...entry,
          tripData: {
            ...entry.tripData,
            meta: entry.tripData?.meta ?? {
              total_estimated_budget: parseBudget(entry.budgetInput) || 0,
            },
            is_public:
              typeof entry.tripData?.is_public === "boolean"
                ? entry.tripData.is_public
                : true,
          },
        }));
        setHistory(normalized);
      } catch {
        setHistory([]);
      }
    }
  }, []);

  useEffect(() => {
    if (checkingAuth) return;
    fetch("/api/ai/profile")
      .then((res) => res.json())
      .then((data) => {
        setIsPremium(Boolean(data?.is_premium));
      })
      .catch(() => {
        setIsPremium(false);
      });
  }, [checkingAuth]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

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
    if (trip.is_public === false && !pdfIsPremium) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return origin ? `${origin}/trip/${trip.share_code}` : "";
  }, [trip?.share_code, trip?.is_public, pdfIsPremium]);

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
    if (!trip?.id || !isPremium) return;
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
  }, [prepChecklist, trip, isPremium]);

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
    if (destMatch) setDestination(destMatch[1].trim().split(" ")[0]);
    
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

  const deleteTrip = (index: number) => {
    const updated = history.filter((_, i) => i !== index);
    setHistory(updated);
    localStorage.setItem("trip_history", JSON.stringify(updated));
  };

  const updateHistoryEntry = (updatedTrip: Trip) => {
    setHistory((prev) => {
      const next = prev.map((entry) => {
        if (
          entry.tripData?.share_code &&
          updatedTrip.share_code &&
          entry.tripData.share_code === updatedTrip.share_code
        ) {
          return { ...entry, tripData: updatedTrip };
        }
        return entry;
      });
      localStorage.setItem("trip_history", JSON.stringify(next));
      return next;
    });
  };

  const persistTripResult = async (updatedTrip: Trip) => {
    if (!updatedTrip.id) return;
    setSavingChanges(true);
    try {
      const res = await fetch("/api/trips/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: updatedTrip.id,
          days: updatedTrip.days,
          meta: updatedTrip.meta,
        }),
      });

      if (!res.ok) {
        const msg = await parseApiError(res);
        showToast(msg);
      }
    } catch {
      showToast("Failed to save changes.");
    } finally {
      setSavingChanges(false);
    }
  };

  // --- CORE GENERATION LOGIC ---
  const generatePlan = async () => {
    setStreamError(null);
    const daysNum = Number(durationInput);
    const budgetNum = parseBudget(budget);

    if (!destination.trim()) {
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
    if (!interests.trim()) {
      setFormError("Please add at least one interest.");
      return;
    }

    setLoading(true);
    setFormError(null);
    setStreamError(null);
    // Initialize empty trip structure
    setTrip({
      destination,
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
          destination,
          days: daysNum,
          budget: budgetNum,
          interests
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
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(Boolean);

        for (const line of lines) {
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

        if (stopStream) {
          await reader.cancel();
          break;
        }
      }

      setStreaming(false);
      if (hadStreamError) return;

      // Construct Final Object for History
      const finalTrip: Trip = applyBudgetToTrip({
        id: tripId || undefined,
        destination,
        days: accumulatedDays,
        meta: accumulatedMeta,
        share_code: shareCode,
        is_public: isPublic
      });

      if (finalTrip.days.length === 0) {
        setStreamError("No days were generated. Please try again.");
        return;
      }

      const savedEntry: SavedTrip = {
        destination,
        daysInput: durationInput,
        budgetInput: budget,
        interestsInput: interests,
        tripData: finalTrip,
        time: Date.now(),
      };

      // Update Local History
      const updated = [savedEntry, ...history].slice(0, 10);
      setHistory(updated);
      localStorage.setItem("trip_history", JSON.stringify(updated));

      await fetchWeather(destination, Number(durationInput));

    } catch (e) {
      console.error(e);
      setStreamError("❌ AI generation failed. Please try again.");
      setStreaming(false);
    } finally {
      setLoading(false);
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

      const res = await fetch("/api/ai/day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          days: trip.days.length || Number(durationInput),
          day_number: dayNumber,
          budget: parseBudget(budget),
          interests,
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

  const replaceActivity = async (dayNumber: number, activityId: string) => {
    if (!trip) return;
    if (replacingActivityId) return;

    const targetDay = trip.days.find((day) => day.day_number === dayNumber);
    if (!targetDay) return;
    const targetActivity = targetDay.activities.find((act) => act.id === activityId);
    if (!targetActivity) return;

    setStreamError(null);
    setReplacingActivityId(activityId);

    try {
      const avoidTitles = targetDay.activities
        .filter((a) => a.id !== activityId)
        .map((a) => a.title)
        .filter(Boolean);

      const res = await fetch("/api/ai/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          day_number: dayNumber,
          budget: parseBudget(budget),
          interests,
          current_title: targetActivity.title,
          order_index: targetActivity.order_index,
          avoid_titles: avoidTitles,
        }),
      });

      if (!res.ok) {
        const msg = await parseApiError(res);
        showToast(msg);
        return;
      }

      const newActivity = await res.json();
      const updatedTrip = applyBudgetToTrip({
        ...trip,
        days: trip.days.map((day) => {
          if (day.day_number !== dayNumber) return day;
          return {
            ...day,
            activities: day.activities.map((act) =>
              act.id === activityId ? newActivity : act
            ),
          };
        }),
      });
      setTrip(updatedTrip);
      updateHistoryEntry(updatedTrip);
      await persistTripResult(updatedTrip);
      showToast("Activity replaced.");
    } catch {
      showToast("Failed to replace activity.");
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
    if (!premiumInsights?.canOptimize) {
      showToast("Not enough location data to optimize routes.");
      return;
    }
    setOptimizingRoutes(true);
    try {
      const updatedDays = trip.days.map((day) => {
        const sorted = [...day.activities].sort(
          (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
        );
        const withCoords = sorted.filter((activity) => getActivityCoord(activity));
        if (withCoords.length < 2) return day;
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
        const merged = [...ordered, ...withoutCoords].map((activity, index) => ({
          ...activity,
          order_index: index,
        }));
        return { ...day, activities: merged };
      });
      const updatedTrip = applyBudgetToTrip({
        ...trip,
        days: updatedDays,
      });
      setTrip(updatedTrip);
      updateHistoryEntry(updatedTrip);
      await persistTripResult(updatedTrip);
      showToast("Routes optimized for shorter travel.");
    } catch {
      showToast("Route optimization failed.");
    } finally {
      setOptimizingRoutes(false);
    }
  };

  const swapExpensiveActivity = async () => {
    if (!trip || replacingActivityId) return;
    const expensive = premiumInsights?.expensiveActivity;
    if (!expensive?.activity?.id) {
      showToast("No pricey activity to swap yet.");
      return;
    }
    await replaceActivity(expensive.day, expensive.activity.id);
  };

  const wordToNumber = (value: string) => {
    const map: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
      first: 1,
      second: 2,
      third: 3,
      fourth: 4,
      fifth: 5,
      sixth: 6,
      seventh: 7,
      eighth: 8,
      ninth: 9,
      tenth: 10,
    };
    if (!value) return null;
    const key = value.toLowerCase();
    return map[key] ?? null;
  };

  const parseNumberToken = (token?: string | null) => {
    if (!token) return null;
    if (/^\d+$/.test(token)) return Number(token);
    const word = wordToNumber(token);
    return word ?? null;
  };

  const parseDayNumber = (text: string) => {
    const match =
      text.match(/day\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third)/i) ||
      text.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*day/i);
    return parseNumberToken(match?.[1] || match?.[1]);
  };

  const parseActivityIndex = (text: string) => {
    const match =
      text.match(/activity\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third)/i) ||
      text.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third)\s+activity/i);
    const index = parseNumberToken(match?.[1] || match?.[1]);
    return index ? index - 1 : null;
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

  const handleVoiceCommand = (text: string) => {
    const lower = text.toLowerCase();

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

  const renderVoiceSettings = () => {
    const toggleSetting = (key: keyof Omit<VoiceSettings, "lang">) => {
      setVoiceSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    return (
      <div className="rahi-card p-4 border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <span className="rahi-label">Voice Settings</span>
          <span className="text-[10px] text-gray-400 uppercase tracking-[0.18em]">
            Personal
          </span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Voice Replies</p>
              <p className="text-xs text-gray-400">Speak AI responses aloud.</p>
            </div>
            <button
              className={`rahi-toggle ${voiceSettings.tts ? "is-on" : ""}`}
              onClick={() => toggleSetting("tts")}
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
              onClick={() => toggleSetting("earcons")}
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
              onClick={() => toggleSetting("autoSend")}
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
      </div>
    );
  };

  const sendChat = async (overrideText?: string, source: "text" | "voice" = "text") => {
    const userMsg = overrideText || chatInput;
    const isVoice = source === "voice";
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
        if (!isVoice) speakWithHeart(aiMsg, lang);
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
  const glassPanel = "rahi-panel";
  const inputContainer = "relative group";
  const inputIcon = "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-teal-300 transition-colors";
  const inputField = "rahi-input pl-12 pr-4 py-4";
  const labelStyle = "rahi-label mb-2";
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

  return (
    <main className="relative min-h-screen bg-black text-white selection:bg-teal-500 selection:text-black overflow-hidden">
      {/* 1. GLOBAL ANIMATED BACKGROUND */}
      <RahiBackground />

      {checkingAuth ? (
        <div className="min-h-screen flex items-center justify-center text-teal-300 px-6">
          <div className="rahi-panel px-8 py-6 flex flex-col items-center gap-4">
            <div className="h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <p className="animate-pulse">Loading Rahi.AI...</p>
          </div>
        </div>
      ) : (
        <>
        <div className="relative z-10 p-4 sm:p-6 md:p-12 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
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
        {toast && (
          <div className="fixed top-6 right-6 z-50 rounded-xl border border-white/10 bg-black/80 px-4 py-2 text-sm text-white shadow-lg backdrop-blur">
            {toast}
          </div>
        )}
        
        {/* HEADER */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: premiumEase }}
          className="mb-8 text-center"
        >
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse"/>
            <span className="text-teal-400 text-sm font-mono tracking-widest uppercase">
              Rahi.AI System Active
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-black text-white tracking-tight mb-2">
            {MODE_CONFIG[plannerMode]?.title}
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            {MODE_CONFIG[plannerMode]?.subtitle}
            {tripType !== "general" && (
              <span className="block text-teal-300 text-sm italic mt-1">
                Currently optimized for: {TYPE_HINTS[tripType]}
              </span>
            )}
          </p>
        </motion.div>

        {plannerMode === "chat" ? (
          /* ---------------- CHAT MODE UI ---------------- */
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: premiumEase }}
            className={`w-full max-w-4xl mx-auto ${glassPanel} flex flex-col h-[70vh] md:h-[75vh] overflow-hidden`}
          >
            {/* Chat Header */}
            <div className="p-4 border-b border-white/10 bg-black/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="h-10 w-10 rounded-full bg-teal-500/20 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-teal-400" />
                 </div>
                 <div>
                   <h3 className="font-bold text-white">Rahi Assistant</h3>
                   <div className="flex items-center gap-1.5">
                     <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                     <span className="text-xs text-gray-400">Online</span>
                   </div>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rahi-btn-ghost"
                  onClick={() => setVoiceSettingsOpen((prev) => !prev)}
                >
                  <Settings className="w-4 h-4" />
                  Voice
                </button>
                <RahiVoiceUI
                  onText={(text) => {
                    if (handleVoiceCommand(text)) {
                      setVoiceStatus("idle");
                      return;
                    }
                    setChatInput(text);
                    setTimeout(() => sendChat(text, "voice"), 200);
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
              </div>
            </div>
            {voiceSettingsOpen && (
              <div className="px-4 pb-4">
                {renderVoiceSettings()}
              </div>
            )}

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                  <div className="p-6 rounded-full bg-white/5 border border-white/10">
                    <MessageSquare className="h-12 w-12 text-teal-500/50" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg text-white font-medium">👋 Hi! I'm Rahi.AI</p>
                    <p className="text-sm">Ask me anything to start planning.</p>
                  </div>
                  <div className="flex gap-2 text-xs">
                      <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition" onClick={() => sendChat("Plan a trip to Goa")}>🏖️ Plan Goa Trip</span>
                      <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition" onClick={() => sendChat("Budget tips for students")}>💰 Budget Tips</span>
                  </div>
                </div>
              )}

              {chatMessages.map((msg, i) => {
                const isAI = msg.startsWith("Rahi.AI:");
                const textContent = isAI ? msg.slice(8) : msg.slice(4);

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={i}
                    className={`flex ${isAI ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[85%] p-4 rounded-2xl ${
                        isAI
                          ? "bg-white/10 text-gray-200 border border-white/5 rounded-tl-none"
                          : "bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg rounded-tr-none"
                      }`}
                    >
                      <span className="block text-[10px] opacity-70 mb-1 font-bold uppercase tracking-wider">
                        {isAI ? "Rahi.AI" : "You"}
                      </span>
                      <div className="prose prose-invert prose-sm leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {textContent}
                        </ReactMarkdown>
                      </div>

                      {isAI && looksLikeItinerary(textContent) && (
                        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/10">
                          <button
                            onClick={() => {
                              syncFieldsFromChat(textContent);
                              router.push("/planner?mode=ai");
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/20 hover:bg-teal-500/40 text-teal-300 text-xs rounded-lg transition border border-teal-500/30"
                          >
                            <Plane className="w-3 h-3" /> Convert to Planner
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}

              {typing && (
                <div className="flex items-center gap-2 text-gray-500 text-sm italic ml-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '0s' }}/>
                    <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '0.2s' }}/>
                    <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '0.4s' }}/>
                  </div>
                  Rahi is thinking...
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 sm:p-4 bg-black/40 border-t border-white/10 backdrop-blur-md">
              <div className="flex gap-2">
                <input
                  className="flex-1 rahi-input"
                  placeholder="Ask Rahi (e.g., '3 day trip to Manali under 10k')..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                />
                <button
                  onClick={() => sendChat()}
                  className="rahi-btn-primary px-3 py-3"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          /* ---------------- PLANNER / BUDGET MODE UI ---------------- */
          <div className="grid lg:grid-cols-12 gap-6 md:gap-10">
            
            {/* LEFT COLUMN: INPUT FORM */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: premiumEase }}
              className={`lg:col-span-5 ${glassPanel} p-6 md:p-8 h-fit`}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-teal-500/20 rounded-lg">
                    <Compass className="w-6 h-6 text-teal-400" />
                </div>
                <h2 className="text-xl font-display font-bold text-white">Trip Details</h2>
              </div>

              <div className="space-y-6">
                <div className={inputContainer}>
                  <label className={labelStyle}>Where to?</label>
                  <MapPin className={inputIcon} />
                  <input
                    className={inputField}
                    placeholder="E.g., Goa, Manali, Jaipur"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
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
                       onChange={(e) => setBudget(e.target.value)}
                     />
                   </div>
                   <div className={inputContainer}>
                     <label className={labelStyle}>Duration</label>
                     <Calendar className={inputIcon} />
                     <input
                       className={inputField}
                       placeholder="Days"
                       value={durationInput}
                       onChange={(e) => setDurationInput(e.target.value)}
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
                    onChange={(e) => setInterests(e.target.value)}
                  />
                </div>

                {formError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {formError}
                  </div>
                )}

                <button
                  onClick={generatePlan}
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
                        {renderVoiceSettings()}
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
                        key={t.time}
                        className="group flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-teal-500/30 transition cursor-pointer"
                        onClick={() => {
                          setDestination(t.destination);
                          setDurationInput(t.daysInput);
                          setBudget(t.budgetInput);
                          setInterests(t.interestsInput);
                          setTrip(t.tripData);
                          fetchWeather(
                            t.destination,
                            Number(t.daysInput) || t.tripData.days?.length || 5
                          );
                        }}
                      >
                        <div>
                            <p className="font-bold text-teal-400 text-sm">{t.destination}</p>
                            <p className="text-xs text-gray-500">{t.daysInput} Days • ₹{t.budgetInput}</p>
                        </div>
                        <button
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
               className={`lg:col-span-7 ${glassPanel} p-6 md:p-8 min-h-[520px] md:min-h-[600px] flex flex-col relative`}
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
                <div className="flex flex-col items-center justify-center flex-1 text-gray-500 opacity-60">
                  <div className="p-8 rounded-full bg-white/5 border border-white/5 mb-4">
                      <Plane className="w-16 h-16 text-teal-500/30" />
                  </div>
                  <p className="text-xl font-display font-medium text-white mb-2">Ready for takeoff?</p>
                  <p className="text-sm max-w-xs text-center">Fill in the details on the left and let Rahi.AI create your magic itinerary.</p>
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
                      {savingChanges && (
                        <span className="text-xs text-teal-300/80 animate-pulse">
                          Saving...
                        </span>
                      )}
                      {isPremium ? (
                        <button
                          onClick={manageBilling}
                          disabled={billingLoading}
                          className="rahi-btn-secondary text-sm disabled:opacity-60"
                        >
                          {billingLoading ? "Opening..." : "Manage Plan"}
                        </button>
                      ) : premiumEnabled ? (
                        <button
                          onClick={startUpgrade}
                          disabled={billingLoading}
                          className="rahi-btn-primary px-4 py-2 text-sm disabled:opacity-60"
                        >
                          {billingLoading ? "Opening..." : "Upgrade"}
                        </button>
                      ) : (
                        <button
                          onClick={() => setWaitlistOpen(true)}
                          className="rahi-btn-primary px-4 py-2 text-sm"
                        >
                          Premium Soon
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
                       className="rahi-btn-primary px-4 py-2 text-sm">
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
                    </div>
                  </div>

                  {/* PDF Content Area */}
                  <div id="pdf-content" className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                      <div className="hidden pdf-only mb-6">
                        <h1 className="text-3xl font-bold">Rahi.AI Itinerary</h1>
                        <p>Trip to {destination}</p>
                      </div>

                      {/* Weather Section */}
                      {tripHealth && (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-teal-400 font-bold text-sm uppercase tracking-wide">
                              <ShieldCheck className="w-4 h-4" /> Trip Health
                            </div>
                            <button
                              onClick={autoFixTrip}
                              disabled={!tripHealth.fixableDays.length || fixingTrip}
                              className="rahi-btn-ghost text-[10px] disabled:opacity-60"
                            >
                              {fixingTrip ? "Fixing..." : "Auto Fix"}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-black/20 p-3 rounded-lg">
                              <p className="text-xs text-gray-400">Score</p>
                              <p className="text-lg font-bold text-white">{tripHealth.summary.score}</p>
                            </div>
                            <div className="bg-black/20 p-3 rounded-lg">
                              <p className="text-xs text-gray-400">Missing spots</p>
                              <p className="text-lg font-bold text-white">{tripHealth.summary.missingLocations}</p>
                            </div>
                            <div className="bg-black/20 p-3 rounded-lg">
                              <p className="text-xs text-gray-400">Duplicates</p>
                              <p className="text-lg font-bold text-white">{tripHealth.summary.duplicateActivities}</p>
                            </div>
                            <div className="bg-black/20 p-3 rounded-lg">
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
                                  className="text-xs text-gray-400 border border-white/5 rounded-lg px-3 py-2 bg-black/10"
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
                            <p className="text-xs text-gray-400 mt-3">
                              Everything looks great. Ready to travel.
                            </p>
                          )}
                        </div>
                      )}

                      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm uppercase tracking-wide">
                            <Sparkles className="w-4 h-4" /> Premium Intelligence
                          </div>
                          <span className="text-[10px] text-gray-400 uppercase tracking-[0.18em]">
                            Insights
                          </span>
                        </div>
                        {isPremium ? (
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
                                disabled={!premiumInsights?.canOptimize || optimizingRoutes}
                                className="rahi-btn-secondary text-xs disabled:opacity-60"
                              >
                                {optimizingRoutes ? "Optimizing..." : "Optimize routes"}
                              </button>
                              <button
                                type="button"
                                onClick={swapExpensiveActivity}
                                disabled={!premiumInsights?.expensiveActivity || Boolean(replacingActivityId)}
                                className="rahi-btn-ghost text-xs disabled:opacity-60"
                              >
                                Swap pricey stop
                              </button>
                            </div>
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

                      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 text-teal-400 font-bold text-sm uppercase tracking-wide">
                            <Sparkles className="w-4 h-4" /> Rahi.AI Signature Plans
                          </div>
                          <span className="text-[10px] text-gray-400 uppercase tracking-[0.18em]">
                            3-Plan Stack
                          </span>
                        </div>
                        {isPremium ? (
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

                      {(weather.length > 0 || weatherLoading || weatherError) && (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                          <div className="flex items-center gap-2 mb-3 text-teal-400 font-bold text-sm uppercase tracking-wide">
                             <CloudSun className="w-4 h-4" /> Forecast
                          </div>
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
                      )}

                      {pdfIsPremium && (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-teal-400 font-bold text-sm uppercase tracking-wide">
                              <Sparkles className="w-4 h-4" /> Premium PDF Studio
                            </div>
                            <span className="text-[10px] text-gray-400 uppercase tracking-[0.18em]">
                              Theme
                            </span>
                          </div>
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
                      )}

                      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 text-teal-400 font-bold text-sm uppercase tracking-wide">
                            <MapPin className="w-4 h-4" /> Trip Map
                          </div>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              trip.destination
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rahi-btn-ghost text-[10px]"
                          >
                            Open Map
                          </a>
                        </div>
                        <TripMap
                          destination={trip.destination}
                          stops={mapStops}
                          mapboxToken={mapboxToken}
                          premium={isPremium}
                        />
                        {mapEnriching && (
                          <p className="text-xs text-gray-400 mt-2">
                            Enhancing map locations...
                          </p>
                        )}
                        {mapStops.length === 0 && (
                          <p className="text-xs text-gray-400 mt-3">
                            Add locations or regenerate for map pins.
                          </p>
                        )}
                      </div>

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

// all perfect 
