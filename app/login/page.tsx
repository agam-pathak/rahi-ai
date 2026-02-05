"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Loader2, ArrowRight } from "lucide-react";
import RahiBackground from "@/components/RahiBackground";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const premiumEase = [0.16, 1, 0.3, 1] as const;
  
  // Loading state for API call
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    setLoading(false);
    if (res.error) {
      setError(res.error.message);
    } else {
      setLinkSent(true);
    }
  };

  const googleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <RahiBackground />

      <div className="relative z-10 w-full max-w-md">
        <AnimatePresence mode="wait">
          <motion.div 
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: premiumEase }}
              className="rahi-panel p-8"
            >
              <div className="text-center mb-8">
                <h1 className="text-4xl font-display font-bold text-white tracking-tight mb-2">
                  Rahi.AI
                </h1>
                <p className="text-gray-300 text-sm">
                  Sign in with a secure email link.
                </p>
              </div>

              <form onSubmit={handleAuth} className="space-y-5">
                <div className="relative group">
                  <Mail className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 group-focus-within:text-teal-400 transition-colors" />
                  <input
                    type="email"
                    required
                    placeholder="Email address"
                    className="rahi-input pl-10 pr-4 py-3"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.4, ease: premiumEase }}
                      className="text-red-400 text-sm text-center bg-red-900/20 py-2 rounded border border-red-500/20"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rahi-btn-primary py-3 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                  {linkSent ? "Resend link" : "Send magic link"}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
              
              {linkSent && (
                <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 text-center">
                  Check your inbox for a secure sign‑in link.
                </div>
              )}

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-transparent text-gray-400 bg-opacity-0 backdrop-blur-none">
                    Or continue with
                  </span>
                </div>
              </div>

              <button
                onClick={googleLogin}
                className="w-full bg-white text-gray-900 font-semibold py-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </button>

              <p className="mt-8 text-center text-gray-400 text-sm">
                Magic link works for new and existing users.
              </p>
            </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}
