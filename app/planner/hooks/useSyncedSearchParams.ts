"use client";

import { useEffect, useState } from "react";

export function useSyncedSearchParams() {
  const [searchParams, setSearchParams] = useState(() => new URLSearchParams());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncParams = () => {
      setSearchParams(new URLSearchParams(window.location.search));
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    const onPopState = () => {
      syncParams();
    };

    window.history.pushState = function (...args) {
      originalPushState.apply(window.history, args);
      syncParams();
    };

    window.history.replaceState = function (...args) {
      originalReplaceState.apply(window.history, args);
      syncParams();
    };

    window.addEventListener("popstate", onPopState);
    syncParams();

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return searchParams;
}
