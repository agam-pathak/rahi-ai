"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";
import { Mail, Lock, Loader2, ArrowRight, Plane } from "lucide-react";
import RahiBackground from "@/components/RahiBackground";

const AUTH_NETWORK_ERROR_MESSAGE =
  "Cannot reach authentication server right now. Please check your network or try again shortly.";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeAuthError = (input: unknown) => {
  const rawMessage =
    typeof input === "string"
      ? input
      : input && typeof input === "object" && "message" in input
        ? String((input as { message?: unknown }).message ?? "")
        : "";
  const message = rawMessage.trim();
  const lower = message.toLowerCase();
  const looksLikeNetworkFailure =
    lower.includes("failed to fetch") ||
    lower.includes("fetch failed") ||
    lower.includes("networkerror") ||
    lower.includes("timed out") ||
    lower.includes("err_connection") ||
    lower.includes("offline");
  if (looksLikeNetworkFailure) return AUTH_NETWORK_ERROR_MESSAGE;
  return message || "Authentication failed. Please try again.";
};

export default function LoginPage() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const premiumEase = [0.16, 1, 0.3, 1] as const;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [nextPath, setNextPath] = useState("/");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMode, setSuccessMode] = useState<"login" | "signup" | "recovery">("login");
  const [error, setError] = useState<string | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryConfirm, setRecoveryConfirm] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [shakePulse, setShakePulse] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [googleHovered, setGoogleHovered] = useState(false);
  const [cursorGlow, setCursorGlow] = useState({ x: 50, y: 38 });
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const rawNext = params.get("next");
    setNextPath(rawNext && rawNext.startsWith("/") ? rawNext : "/");
    if (params.get("mode") === "recovery" || hashParams.get("type") === "recovery") {
      setIsRecoveryMode(true);
      setMode("login");
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
        setMode("login");
        setError(null);
        setRecoveryError(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(
    () => () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!shakePulse || shouldReduceMotion) return;
    setShaking(true);
    const timer = setTimeout(() => setShaking(false), 420);
    return () => clearTimeout(timer);
  }, [shakePulse, shouldReduceMotion]);

  useEffect(() => {
    if (mode !== "login" || isRecoveryMode) {
      setForgotOpen(false);
      setForgotError(null);
      setForgotSuccess(null);
    }
  }, [mode, isRecoveryMode]);

  const containerVariants: Variants = shouldReduceMotion
    ? {
        hidden: { opacity: 1 },
        visible: { opacity: 1 },
      }
    : {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.09, delayChildren: 0.1 },
        },
      };

  const itemVariants: Variants = shouldReduceMotion
    ? {
        hidden: { opacity: 1 },
        visible: { opacity: 1 },
      }
    : {
        hidden: { opacity: 0, y: 14 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.55, ease: premiumEase },
        },
      };

  const modeCopy = isRecoveryMode
    ? {
        subtitle: "Set a new password to finish account recovery.",
        submitLabel: "Update Password",
        switchPrompt: "Remembered your password?",
        switchAction: "Back to sign in",
      }
    : mode === "login"
      ? {
          subtitle: "Welcome back to your journey.",
          submitLabel: "Sign In",
          switchPrompt: "New to Rahi?",
          switchAction: "Start here",
        }
      : {
          subtitle: "Create your account and launch your next plan.",
          submitLabel: "Create Account",
          switchPrompt: "Already a traveler?",
          switchAction: "Log in",
        };

  const emailRaised = emailFocused || email.length > 0;
  const passwordRaised = passwordFocused || password.length > 0;
  const submitBusy = isRecoveryMode ? recoveryLoading : loading;

  const showAuthError = (value: unknown) => {
    setError(normalizeAuthError(value));
    setShakePulse((prev) => prev + 1);
  };

  const handleForgotPassword = async () => {
    const emailInput = (forgotEmail || email).trim().toLowerCase();
    if (!EMAIL_PATTERN.test(emailInput)) {
      setForgotError("Enter a valid email address to send the reset link.");
      setForgotSuccess(null);
      return;
    }

    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailInput, {
        redirectTo: `${window.location.origin}/login?mode=recovery`,
      });
      if (resetError) {
        setForgotError(normalizeAuthError(resetError));
        return;
      }
      setForgotEmail(emailInput);
      setForgotSuccess("Reset link sent. Check your inbox and spam folder.");
    } catch (err) {
      setForgotError(normalizeAuthError(err));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleRecoveryPasswordUpdate = async () => {
    setRecoveryError(null);
    if (recoveryPassword.length < 8) {
      setRecoveryError("Password must be at least 8 characters.");
      return;
    }
    if (recoveryPassword !== recoveryConfirm) {
      setRecoveryError("Passwords do not match.");
      return;
    }

    setRecoveryLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setRecoveryError("Recovery link expired. Request a new password reset link.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: recoveryPassword,
      });
      if (updateError) {
        setRecoveryError(normalizeAuthError(updateError));
        return;
      }

      setSuccessMode("recovery");
      setSuccess(true);
      setRecoveryPassword("");
      setRecoveryConfirm("");
      redirectTimerRef.current = setTimeout(() => {
        router.replace("/planner");
      }, 1700);
    } catch (err) {
      setRecoveryError(normalizeAuthError(err));
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isRecoveryMode) {
      await handleRecoveryPasswordUpdate();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const emailInput = email.trim().toLowerCase();
      if (mode === "login") {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: emailInput,
          password,
        });
        if (signInError) {
          showAuthError(signInError);
          return;
        }
        if (!data.session || !data.user) {
          showAuthError("Authentication failed. Please try again.");
          return;
        }
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: emailInput,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        if (signUpError) {
          showAuthError(signUpError);
          return;
        }
        if (!data.user) {
          showAuthError("Authentication failed. Please try again.");
          return;
        }
      }

      setSuccessMode(mode);
      setSuccess(true);
      redirectTimerRef.current = setTimeout(() => {
        if (mode === "signup") {
          router.replace("/login");
          return;
        }
        router.replace(nextPath);
      }, mode === "signup" ? 2200 : 1800);
    } catch (err) {
      showAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async () => {
    setError(null);
    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${nextPath}`,
        },
      });
      if (googleError) {
        showAuthError(googleError);
        return;
      }
    } catch (err) {
      showAuthError(err);
    }
  };

  return (
    <main
      className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 sm:px-6"
      onMouseMove={(event) => {
        if (shouldReduceMotion) return;
        const width = window.innerWidth || 1;
        const height = window.innerHeight || 1;
        setCursorGlow({
          x: Math.max(0, Math.min(100, (event.clientX / width) * 100)),
          y: Math.max(0, Math.min(100, (event.clientY / height) * 100)),
        });
      }}
    >
      <RahiBackground />
      {!shouldReduceMotion && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background: `radial-gradient(540px circle at ${cursorGlow.x}% ${cursorGlow.y}%, rgba(45,212,191,0.2), rgba(56,189,248,0.12) 36%, transparent 72%)`,
          }}
          animate={{ opacity: [0.6, 0.92, 0.6] }}
          transition={{ duration: 6, ease: "easeInOut", repeat: Infinity }}
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_14%_12%,rgba(34,211,238,0.22),transparent_38%),radial-gradient(circle_at_82%_88%,rgba(20,184,166,0.18),transparent_42%)]"
      />

      <div className="relative z-10 w-full max-w-md">
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 18, scale: 0.98, filter: "blur(6px)" }
              }
              animate={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
              }
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.99 }}
              transition={{ duration: 0.55, ease: premiumEase }}
              className="rahi-panel relative overflow-hidden border border-teal-300/25 bg-slate-950/85 p-8 text-center backdrop-blur-2xl sm:p-10"
            >
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                animate={
                  shouldReduceMotion
                    ? { opacity: 0.3 }
                    : {
                        background: [
                          "radial-gradient(circle at 25% 20%, rgba(45,212,191,0.2), transparent 55%)",
                          "radial-gradient(circle at 72% 78%, rgba(14,165,233,0.2), transparent 55%)",
                          "radial-gradient(circle at 25% 20%, rgba(45,212,191,0.2), transparent 55%)",
                        ],
                      }
                }
                transition={{ duration: 4.5, ease: "easeInOut", repeat: Infinity }}
              />
              <div className="relative">
                <motion.div
                  className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-teal-300/40 bg-teal-500/15"
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                  animate={
                    shouldReduceMotion
                      ? { opacity: 1 }
                      : { opacity: 1, scale: [0.96, 1.03, 1], rotate: [0, -4, 0] }
                  }
                  transition={{ duration: 0.9, ease: premiumEase }}
                >
                  <Plane className="h-10 w-10 text-teal-200" />
                </motion.div>

                <motion.h2
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12, duration: 0.55, ease: premiumEase }}
                  className="mb-2 text-3xl font-display font-bold text-white"
                >
                  {successMode === "signup"
                    ? "Account Created"
                    : successMode === "recovery"
                      ? "Password Updated"
                      : "Welcome Back"}
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5, ease: premiumEase }}
                  className="text-sm text-gray-300"
                >
                  {successMode === "signup"
                    ? "You're ready. Confirm email if prompted, then continue."
                    : successMode === "recovery"
                      ? "Your new password is active. Opening your planner now."
                    : "Securing your route and opening your planner."}
                </motion.p>

                <div className="mt-6 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-1.5 rounded-full bg-gradient-to-r from-teal-300 via-cyan-300 to-sky-300"
                    initial={{ scaleX: 0, originX: 0 }}
                    animate={{ scaleX: 1, originX: 0 }}
                    transition={{
                      duration: successMode === "signup" ? 2.2 : 1.8,
                      ease: "linear",
                    }}
                  />
                </div>
                <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-teal-100/70">
                  Routing securely...
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              layout
              initial={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 18, scale: 0.985, filter: "blur(10px)" }
              }
              animate={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
              }
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.99 }}
              transition={{ duration: 0.6, ease: premiumEase }}
              className="rahi-panel relative overflow-hidden border border-cyan-300/25 bg-[#050b21]/85 p-6 backdrop-blur-2xl sm:p-8"
            >
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl"
                animate={shouldReduceMotion ? { opacity: 0.55 } : { opacity: [0.38, 0.75, 0.38] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-20 -right-16 h-52 w-52 rounded-full bg-teal-300/15 blur-3xl"
                animate={shouldReduceMotion ? { opacity: 0.45 } : { opacity: [0.25, 0.62, 0.25] }}
                transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
              />

              <motion.div variants={containerVariants} initial="hidden" animate="visible">
                <motion.div variants={itemVariants} className="mb-7 text-center">
                  <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-cyan-200/80">
                    {isRecoveryMode ? "Password Recovery" : "Secure Traveler Login"}
                  </p>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={mode}
                      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.32, ease: premiumEase }}
                    >
                      <h1 className="mb-2 text-4xl font-display font-bold tracking-tight text-white">
                        Rahi.AI
                      </h1>
                      <p className="text-sm text-gray-300">{modeCopy.subtitle}</p>
                    </motion.div>
                  </AnimatePresence>
                </motion.div>

                <motion.form
                  variants={itemVariants}
                  onSubmit={handleAuth}
                  className="space-y-4"
                  animate={shaking && !shouldReduceMotion ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                >
                  {isRecoveryMode ? (
                    <>
                      <p className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                        Enter your new password below. This works only from a valid recovery email link.
                      </p>
                      <div className="relative overflow-hidden rounded-2xl">
                        <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/15 transition-colors duration-300" />
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
                        <label
                          htmlFor="recovery-password"
                          className={`pointer-events-none absolute left-11 transition-all duration-200 ${
                            recoveryPassword.length
                              ? "top-2 text-[10px] uppercase tracking-[0.16em] text-teal-200"
                              : "top-1/2 -translate-y-1/2 text-sm text-gray-400"
                          }`}
                        >
                          New password
                        </label>
                        <input
                          id="recovery-password"
                          type="password"
                          required
                          minLength={8}
                          autoComplete="new-password"
                          placeholder=" "
                          className="h-14 w-full rounded-2xl bg-white/5 pb-2 pl-11 pr-4 pt-5 text-sm text-white outline-none"
                          value={recoveryPassword}
                          onChange={(e) => setRecoveryPassword(e.target.value)}
                        />
                      </div>
                      <div className="relative overflow-hidden rounded-2xl">
                        <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/15 transition-colors duration-300" />
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
                        <label
                          htmlFor="recovery-confirm"
                          className={`pointer-events-none absolute left-11 transition-all duration-200 ${
                            recoveryConfirm.length
                              ? "top-2 text-[10px] uppercase tracking-[0.16em] text-teal-200"
                              : "top-1/2 -translate-y-1/2 text-sm text-gray-400"
                          }`}
                        >
                          Confirm password
                        </label>
                        <input
                          id="recovery-confirm"
                          type="password"
                          required
                          minLength={8}
                          autoComplete="new-password"
                          placeholder=" "
                          className="h-14 w-full rounded-2xl bg-white/5 pb-2 pl-11 pr-4 pt-5 text-sm text-white outline-none"
                          value={recoveryConfirm}
                          onChange={(e) => setRecoveryConfirm(e.target.value)}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="relative overflow-hidden rounded-2xl">
                        <div
                          className={`pointer-events-none absolute inset-0 rounded-2xl border transition-colors duration-300 ${
                            emailFocused ? "border-cyan-300/60" : "border-white/15"
                          }`}
                        />
                        {!shouldReduceMotion && emailFocused && (
                          <motion.span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent"
                            initial={{ x: "-120%" }}
                            animate={{ x: "340%" }}
                            transition={{ duration: 0.95, ease: "easeInOut" }}
                          />
                        )}
                        <Mail
                          className={`pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 transition-colors ${
                            emailFocused ? "text-cyan-200" : "text-gray-400"
                          }`}
                        />
                        <label
                          htmlFor="login-email"
                          className={`pointer-events-none absolute left-11 transition-all duration-200 ${
                            emailRaised
                              ? "top-2 text-[10px] uppercase tracking-[0.16em] text-cyan-200"
                              : "top-1/2 -translate-y-1/2 text-sm text-gray-400"
                          }`}
                        >
                          Email address
                        </label>
                        <input
                          id="login-email"
                          type="email"
                          required
                          autoComplete="email"
                          placeholder=" "
                          className="h-14 w-full rounded-2xl bg-white/5 pb-2 pl-11 pr-4 pt-5 text-sm text-white outline-none"
                          value={email}
                          onFocus={() => setEmailFocused(true)}
                          onBlur={() => setEmailFocused(false)}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>

                      <div className="relative overflow-hidden rounded-2xl">
                        <div
                          className={`pointer-events-none absolute inset-0 rounded-2xl border transition-colors duration-300 ${
                            passwordFocused ? "border-teal-300/60" : "border-white/15"
                          }`}
                        />
                        {!shouldReduceMotion && passwordFocused && (
                          <motion.span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-teal-300/30 to-transparent"
                            initial={{ x: "-120%" }}
                            animate={{ x: "340%" }}
                            transition={{ duration: 0.95, ease: "easeInOut" }}
                          />
                        )}
                        <Lock
                          className={`pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 transition-colors ${
                            passwordFocused ? "text-teal-200" : "text-gray-400"
                          }`}
                        />
                        <label
                          htmlFor="login-password"
                          className={`pointer-events-none absolute left-11 transition-all duration-200 ${
                            passwordRaised
                              ? "top-2 text-[10px] uppercase tracking-[0.16em] text-teal-200"
                              : "top-1/2 -translate-y-1/2 text-sm text-gray-400"
                          }`}
                        >
                          Password
                        </label>
                        <input
                          id="login-password"
                          type="password"
                          required
                          autoComplete={mode === "login" ? "current-password" : "new-password"}
                          placeholder=" "
                          className="h-14 w-full rounded-2xl bg-white/5 pb-2 pl-11 pr-4 pt-5 text-sm text-white outline-none"
                          value={password}
                          onFocus={() => setPasswordFocused(true)}
                          onBlur={() => setPasswordFocused(false)}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>

                      {mode === "login" && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setForgotOpen((prev) => !prev);
                              setForgotEmail((prev) => prev || email);
                              setForgotError(null);
                              setForgotSuccess(null);
                            }}
                            className="text-xs font-semibold text-cyan-200/90 transition hover:text-cyan-100"
                          >
                            {forgotOpen ? "Hide reset form" : "Forgot password?"}
                          </button>
                        </div>
                      )}

                      <AnimatePresence initial={false}>
                        {forgotOpen && mode === "login" && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.28, ease: premiumEase }}
                            className="overflow-hidden rounded-2xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-3"
                          >
                            <p className="text-xs text-cyan-100">
                              We’ll send a password reset link to your email.
                            </p>
                            <input
                              type="email"
                              className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-black/20 px-3 text-sm text-white outline-none"
                              placeholder="you@example.com"
                              value={forgotEmail}
                              onChange={(e) => setForgotEmail(e.target.value)}
                            />
                            {(forgotError || forgotSuccess) && (
                              <p className={`mt-2 text-xs ${forgotError ? "text-rose-200" : "text-emerald-200"}`}>
                                {forgotError || forgotSuccess}
                              </p>
                            )}
                            <div className="mt-3 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setForgotOpen(false);
                                  setForgotError(null);
                                  setForgotSuccess(null);
                                }}
                                className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-gray-200 transition hover:border-white/35"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleForgotPassword()}
                                disabled={forgotLoading}
                                className="rounded-lg border border-cyan-300/40 bg-cyan-300/20 px-3 py-1.5 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-300/30 disabled:opacity-60"
                              >
                                {forgotLoading ? "Sending..." : "Send reset link"}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}

                  <AnimatePresence initial={false}>
                    {(isRecoveryMode ? recoveryError : error) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.32, ease: premiumEase }}
                        className="overflow-hidden rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-center text-sm text-rose-100"
                      >
                        {isRecoveryMode ? recoveryError : error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="submit"
                    disabled={submitBusy}
                    whileHover={!submitBusy && !shouldReduceMotion ? { y: -2, scale: 1.01 } : undefined}
                    whileTap={!submitBusy && !shouldReduceMotion ? { scale: 0.985 } : undefined}
                    className="relative flex h-12 w-full items-center justify-center overflow-hidden rounded-2xl border border-cyan-200/25 bg-gradient-to-r from-teal-300 via-cyan-300 to-sky-300 text-slate-950 shadow-[0_24px_45px_-28px_rgba(56,189,248,0.95)] transition disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {!submitBusy && !shouldReduceMotion && (
                      <motion.span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent"
                        animate={{ x: ["0%", "390%"] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                      />
                    )}
                    {submitBusy && (
                      <motion.span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 opacity-65"
                        style={{
                          backgroundImage:
                            "linear-gradient(115deg, rgba(15,23,42,0.1) 10%, rgba(255,255,255,0.25) 40%, rgba(15,23,42,0.1) 70%)",
                          backgroundSize: "180% 100%",
                        }}
                        animate={{ backgroundPosition: ["0% 0%", "180% 0%"] }}
                        transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                      />
                    )}
                    <span className="relative z-10 inline-flex items-center gap-2 font-semibold">
                      <AnimatePresence mode="wait" initial={false}>
                        {submitBusy ? (
                          <motion.span
                            key="loading"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.2 }}
                            className="inline-flex items-center gap-2"
                          >
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {isRecoveryMode ? "Updating password" : "Securing session"}
                          </motion.span>
                        ) : (
                          <motion.span
                            key={mode}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.2 }}
                            className="inline-flex items-center gap-2"
                          >
                            {modeCopy.submitLabel}
                            <ArrowRight className="h-4 w-4" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                  </motion.button>
                </motion.form>

                {!isRecoveryMode ? (
                  <>
                    <motion.div variants={itemVariants} className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/15" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase tracking-[0.18em]">
                        <span className="bg-[#050b21] px-2 text-gray-400">Or continue with</span>
                      </div>
                    </motion.div>

                    <motion.button
                      variants={itemVariants}
                      type="button"
                      onClick={googleLogin}
                      disabled={loading}
                      onHoverStart={() => setGoogleHovered(true)}
                      onHoverEnd={() => setGoogleHovered(false)}
                      whileHover={!loading && !shouldReduceMotion ? { y: -2, scale: 1.01 } : undefined}
                      whileTap={!loading && !shouldReduceMotion ? { scale: 0.985 } : undefined}
                      className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl border border-white/25 bg-white/95 py-3 font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {!shouldReduceMotion && (
                        <motion.span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 rounded-2xl border border-cyan-400/0"
                          animate={googleHovered ? { boxShadow: "0 0 0 2px rgba(34,211,238,0.2) inset" } : { boxShadow: "0 0 0 0 rgba(34,211,238,0)" }}
                          transition={{ duration: 0.2 }}
                        />
                      )}
                      <motion.svg
                        className="relative z-10 h-5 w-5"
                        viewBox="0 0 24 24"
                        animate={
                          !shouldReduceMotion && googleHovered
                            ? { x: 1.2, rotate: -2, scale: 1.05 }
                            : { x: 0, rotate: 0, scale: 1 }
                        }
                        transition={{ duration: 0.2, ease: premiumEase }}
                      >
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </motion.svg>
                      <span className="relative z-10">Google</span>
                    </motion.button>

                    <motion.p variants={itemVariants} className="mt-7 text-center text-sm text-gray-400">
                      {modeCopy.switchPrompt}{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setMode((prev) => (prev === "login" ? "signup" : "login"));
                          setError(null);
                        }}
                        className="ml-1 font-semibold text-teal-300 transition-colors hover:text-cyan-200"
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={mode}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.2 }}
                            className="inline-block"
                          >
                            {modeCopy.switchAction}
                          </motion.span>
                        </AnimatePresence>
                      </button>
                    </motion.p>
                  </>
                ) : (
                  <motion.p variants={itemVariants} className="mt-6 text-center text-sm text-gray-400">
                    Need another reset link?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsRecoveryMode(false);
                        setRecoveryError(null);
                        setRecoveryPassword("");
                        setRecoveryConfirm("");
                        setMode("login");
                      }}
                      className="ml-1 font-semibold text-teal-300 transition-colors hover:text-cyan-200"
                    >
                      Back to sign in
                    </button>
                  </motion.p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
