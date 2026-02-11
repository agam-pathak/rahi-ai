"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion, Variants } from "framer-motion";
import {
  Compass, Wallet, Bot, ChevronDown, ArrowRight, Globe, Star, Settings, Sparkles
} from "lucide-react";
import RahiBackground from "@/components/RahiBackground";
import ThemeToggle from "@/components/ThemeToggle";
import RahiVoiceUI, { speakWithHeart } from "@/components/RahiVoiceUI";

export default function Home() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
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

  // --- AUTHENTICATION LOGIC (Untouched) ---
  useEffect(() => {
    let mounted = true;
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      if (mounted) {
        setUser(data.session.user);
        setCheckingAuth(false);
      }
    };
    checkSession();
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          router.replace("/login");
          return;
        }
        setUser(session.user);
        setCheckingAuth(false);
      }
    );
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

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
      } catch {}
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, [user]);

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

  const handleVoiceCommand = (text: string) => {
    const lower = text.toLowerCase();
    setVoiceStatus("thinking");

    const go = (url: string, message: string) => {
      announce(message);
      router.push(url);
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
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 },
    },
  };

  const itemVariants: Variants = {
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

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-rahi-bg flex items-center justify-center text-teal-300 px-6">
        <div className="rahi-panel px-8 py-6 flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="animate-pulse">Loading Rahi.AI...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen bg-black text-white overflow-hidden selection:bg-teal-500 selection:text-white">
      
      <RahiBackground />

      {/* 2. GLASS NAVBAR */}
      <nav className="fixed top-0 w-full z-50 border-b border-rahi-border bg-rahi-surface backdrop-blur-xl transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 md:h-20 flex items-center justify-between">
          <motion.div 
             initial={{ opacity: 0, x: -20 }}
             animate={{ opacity: 1, x: 0 }}
             className="rahi-logo flex items-center gap-3 cursor-pointer"
          >
            <div className="rahi-logo-badge">
              <img
                src="/brand/rahi-mark.svg"
                alt="Rahi.AI logo"
                className="h-9 w-9 rounded-xl border border-white/10 shadow-[0_0_18px_rgba(20,184,166,0.35)]"
              />
            </div>
            <svg
              className="rahi-wordmark"
              viewBox="0 0 180 40"
              role="img"
              aria-label="Rahi.AI"
            >
              <text x="0" y="28">Rahi.AI</text>
            </svg>
          </motion.div>

          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <a
              href="/profile"
              aria-label="Profile"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:border-teal-400/40"
            >
              {profileAvatarUrl ? (
                <img
                  src={profileAvatarUrl}
                  alt="Profile"
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <span className="text-[11px] font-semibold text-gray-200">
                  {profileInitials}
                </span>
              )}
            </a>
            <a href="/planner" className="rahi-btn-primary px-3 py-2 text-xs">
              Plan
            </a>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300"
          >
            <button onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-teal-400 transition-colors">Features</button>
            <button onClick={() => document.getElementById("community")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-teal-400 transition-colors">Community</button>
            <a
              href="/profile"
              aria-label="Profile"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:border-teal-400/40"
            >
              {profileAvatarUrl ? (
                <img
                  src={profileAvatarUrl}
                  alt="Profile"
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <span className="text-[11px] font-semibold text-gray-200">
                  {profileInitials}
                </span>
              )}
            </a>
            <button onClick={logout} className="text-red-400 hover:text-red-300 transition-colors">Logout</button>
            <ThemeToggle />
            <a href="/planner" className="rahi-btn-primary px-5 py-2.5 text-sm">
              Start Planning
            </a>
          </motion.div>
        </div>
      </nav>

      {/* 3. HERO SECTION (Restored the specific styling you liked) */}
      <section className="relative z-20 flex flex-col items-center justify-center min-h-screen px-4 text-center pt-24 md:pt-20">
        <div className="rahi-hero-watermark" aria-hidden="true">
          <span>RAHI.AI</span>
        </div>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 max-w-4xl space-y-8"
        >
          <motion.div variants={itemVariants} className="mx-auto flex justify-center">
            <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-teal-500/20 blur-xl" />
            <img
              src="/brand/rahi-mark.svg"
              alt="Rahi.AI"
              className="relative h-16 w-16 rounded-3xl border border-white/10 shadow-[0_0_24px_rgba(20,184,166,0.35)]"
            />
          </div>
        </motion.div>
          {/* The "Future of Travel" Badge */}
          <motion.div variants={itemVariants} className="inline-block">
            <span className="py-1 px-4 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-bold tracking-wider uppercase backdrop-blur-md">
              The Future of Travel
            </span>
          </motion.div>

          {/* Massive Headline */}
          <motion.h1 
            variants={itemVariants}
            className="text-4xl sm:text-6xl md:text-8xl font-display font-black tracking-tight leading-tight"
          >
            Travel Smart with <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-300 drop-shadow-[0_0_35px_rgba(45,212,191,0.4)]">
              Rahi.AI
            </span>
          </motion.h1>

          {/* Subtext */}
          <motion.p 
            variants={itemVariants}
            className="text-lg md:text-2xl text-gray-300 max-w-2xl mx-auto leading-relaxed"
          >
            Plan smarter trips. Save money. Travel confidently with your personal AI companion.
          </motion.p>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 10, 0] }}
          transition={{ delay: 2, duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-10"
        >
          <div className="flex flex-col items-center gap-2 text-gray-400 text-sm">
            <span>Scroll to explore</span>
            <ChevronDown className="h-5 w-5" />
          </div>
        </motion.div>
      </section>

      {/* VOICE CONCIERGE */}
      <section id="voice" className="relative z-20 max-w-7xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-bold tracking-wider uppercase">
              <Sparkles className="h-4 w-4" />
              Rahi Voice Concierge
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white">
              Speak your trip into existence.
            </h2>
            <p className="text-lg text-gray-300 max-w-xl">
              Your home base voice assistant can launch planners, budgets, and travel chats instantly.
              It is fast, focused, and tuned for Rahi.AI tasks.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                className="rahi-btn-primary px-5 py-3 text-sm"
                onClick={() => router.push("/planner?mode=ai")}
              >
                Start Planning <ArrowRight className="h-4 w-4" />
              </button>
              <button
                className="rahi-btn-secondary"
                onClick={() => router.push("/planner?mode=budget")}
              >
                Budget Guardian
              </button>
              <button
                className="rahi-btn-secondary"
                onClick={() => router.push("/planner?mode=chat")}
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

      {/* 4. FEATURES (Your Content) */}
      <section id="features" className="relative z-20 max-w-7xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard 
            icon={<Compass className="h-8 w-8 text-teal-400" />}
            title="AI Trip Planner"
            desc="Personalized travel plans within your budget."
            onClick={() => router.push('/planner?mode=ai')}
            color="hover:border-teal-500/50"
          />
          <FeatureCard 
            icon={<Wallet className="h-8 w-8 text-teal-400" />}
            title="Budget Guardian"
            desc="Track and control your travel expenses."
            onClick={() => router.push('/planner?mode=budget')}
            color="hover:border-teal-500/50"
          />
          <FeatureCard 
            icon={<Bot className="h-8 w-8 text-teal-400" />}
            title="AI Travel Buddy"
            desc="Chat with your AI companion anytime."
            onClick={() => router.push('/planner?mode=chat')}
            color="hover:border-teal-500/50"
          />
        </div>
      </section>

      {/* 5. HOW IT WORKS */}
      <section className="relative z-20 max-w-5xl mx-auto px-6 py-24 border-t border-white/5">
        <SectionHeader title="How Rahi.AI Works" />
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
          {["Plan", "Generate", "Travel", "Save"].map((step, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -5 }}
            className="rahi-card p-8 rounded-2xl text-center hover:bg-white/10 transition-all cursor-default"
          >
              <span className="block text-4xl font-bold text-teal-500/80 mb-2">{i + 1}</span>
              <span className="text-lg font-medium text-white">{step}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 6. BENEFITS */}
      <section className="relative z-20 max-w-7xl mx-auto px-6 py-24 border-t border-white/5">
         <div className="grid md:grid-cols-3 gap-8"> 
           {[
            ["AI Optimized Budgets","Trips planned with smart cost control."],
            ["Local Experience Focus","Discover food, culture and hidden places."],
            ["Student Friendly","Designed for real student travel needs."]
          ].map(([t,d],i)=>(
            <div key={i}
              className="rahi-card p-10 rounded-2xl
              hover:border-teal-500/50 hover:shadow-[0_0_20px_rgba(20,184,166,0.1)]
              transition-all duration-300 backdrop-blur-sm cursor-default">
              <h3 className="text-teal-400 font-semibold text-xl mb-2">{t}</h3>
              <p className="text-gray-400 leading-relaxed">{d}</p>
            </div>
          ))}
         </div>
      </section>

      {/* 7. WHAT YOU CAN PLAN */}
      <section className="relative z-20 max-w-7xl mx-auto px-6 py-24 border-t border-white/5">
        <SectionHeader title="What You Can Plan with Rahi.AI" />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-12">
          {[
            { t: "Solo Trips", v: "solo" },
            { t: "College Trips", v: "college" },
            { t: "Family Trips", v: "family" },
            { t: "Budget Trips", v: "budget" },
            { t: "Adventure", v: "adventure" }
          ].map((item, i) => (
            <motion.button
              key={i}
              onClick={() => router.push(`/planner?type=${item.v}`)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center justify-center gap-3 p-8 rahi-card rounded-2xl hover:bg-teal-500/20 hover:border-teal-500/50 transition-all group"
            >
              <span className="text-lg font-semibold text-gray-200 group-hover:text-white">{item.t}</span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* 8. TESTIMONIALS */}
      <section className="relative z-20 max-w-7xl mx-auto px-6 py-24 border-t border-white/5">
        <SectionHeader title="Loved by Travelers" />
        
        <div className="grid md:grid-cols-3 gap-8 mt-12">
          {[
            "Saved ₹3000 on my trip.",
            "First solo trip felt easy.",
            "Planning became stress free."
          ].map((q, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -5 }}
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

      {/* 9. BOTTOM CTA (Requested) */}
      <section className="relative z-20 py-24 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto rahi-panel p-12 rounded-3xl"
        >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-6">
                Ready to Start Your Journey?
            </h2>
            <p className="text-gray-400 mb-8 text-lg">
                Your next adventure is just a click away. Let AI handle the details.
            </p>
            
            <a 
              href="/planner"
              className="rahi-btn-primary px-10 py-4 text-lg"
            >
               Start Planning Now <ArrowRight className="h-5 w-5" />
            </a>
        </motion.div>
      </section>

      {/* 10. FOOTER */}
      <footer id="community" className="relative z-20 border-t border-white/10 bg-black/40 backdrop-blur-xl py-16 text-center">
        <div className="max-w-4xl mx-auto px-6 space-y-6">
          <Globe className="h-8 w-8 text-teal-500 mx-auto animate-pulse" />
          <p className="text-gray-400 text-lg">Trusted by 1000+ student travelers across India 🇮🇳</p>
          
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
      <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">{title}</h2>
      <div className="h-1 w-20 bg-teal-500 rounded-full mx-auto" />
    </div>
  );
}

function FeatureCard({ icon, title, desc, color, onClick }: any) {
  return (
    <motion.div 
      onClick={onClick}
      whileHover={{ y: -10 }}
      className={`group relative p-8 rounded-3xl rahi-card backdrop-blur-sm transition-all duration-300 hover:bg-white/10 cursor-pointer ${color}`}
    >
      <div className="mb-6 p-4 rounded-2xl bg-black/40 w-fit border border-white/5">
        {icon}
      </div>
      <h3 className="text-2xl font-display font-bold mb-3 text-white">{title}</h3>
      <p className="text-gray-400 leading-relaxed">{desc}</p>
      {/* Glow Effect */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </motion.div>
  );
}
