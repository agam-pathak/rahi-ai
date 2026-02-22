"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export default function AppBackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (!pathname || pathname === "/") {
    return null;
  }

  const onBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  };

  return (
    <button
      type="button"
      onClick={onBack}
      aria-label="Go back"
      title="Go back"
      className="fixed left-4 bottom-5 md:left-6 md:bottom-6 z-[70] inline-flex items-center gap-2 rounded-full border border-white/20 bg-[#0b1220]/85 px-3 py-2 text-sm text-white shadow-lg backdrop-blur-md transition hover:border-teal-400/60 hover:text-teal-200"
      style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="hidden sm:inline">Back</span>
    </button>
  );
}
