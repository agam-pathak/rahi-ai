"use client";

import { useEffect, useState } from "react";

type ThemeMode = "premium" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("premium");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("rahi-theme") as ThemeMode | null;
    const initial = stored === "dark" || stored === "premium" ? stored : "premium";
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next = theme === "premium" ? "dark" : "premium";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("rahi-theme", next);
  };

  if (!mounted) return null;

  return (
    <button
      type="button"
      className="rahi-theme-toggle"
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
    >
      <span className="rahi-theme-pill" data-active={theme}>
        <span className="rahi-theme-label">Premium</span>
        <span className="rahi-theme-label">Dark</span>
        <span className="rahi-theme-indicator" />
      </span>
    </button>
  );
}
