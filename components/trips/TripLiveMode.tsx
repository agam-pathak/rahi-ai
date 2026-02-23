"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  LocateFixed,
  MapPin,
  SkipForward,
  Sparkles,
  Undo2,
} from "lucide-react";

type LiveActivity = {
  id?: string | null;
  title?: string | null;
  location?: {
    name?: string | null;
  } | null;
  estimated_cost?: number | null;
  duration_minutes?: number | null;
  order_index?: number | null;
  type?: string | null;
};

type LiveDay = {
  day_number: number;
  summary?: string | null;
  activities?: LiveActivity[] | null;
};

type ActivityStatus = "pending" | "done" | "skipped";

type ActivityLiveState = {
  status: ActivityStatus;
  delayMinutes: number;
  replacementTitle?: string;
  replacementIndex: number;
  updatedAt: number;
};

type DayState = Record<string, ActivityLiveState>;
type PersistedState = Record<string, DayState>;

type Props = {
  tripId: string;
  destination: string;
  days: LiveDay[];
};

const STORAGE_VERSION = "v1";

const formatCurrency = (value: number) => {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-IN");
};

const formatTime = (minutes: number) => {
  const total = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hrs24 = Math.floor(total / 60);
  const mins = total % 60;
  const suffix = hrs24 >= 12 ? "PM" : "AM";
  const hrs12 = hrs24 % 12 === 0 ? 12 : hrs24 % 12;
  return `${hrs12}:${mins.toString().padStart(2, "0")} ${suffix}`;
};

const getActivityKey = (activity: LiveActivity, index: number, dayNumber: number) =>
  activity.id && activity.id.trim().length > 0
    ? activity.id
    : `${dayNumber}-${index}-${activity.title || "activity"}`;

const getReplacementTitle = (
  activity: LiveActivity,
  destination: string,
  nextIndex: number
) => {
  const type = (activity.type || "").toLowerCase();
  const options =
    type === "food"
      ? ["Street food detour", "Local cafe swap", "Chef-recommended stop"]
      : type === "experience"
      ? ["Hidden gem experience", "Crowd-light alternative", "Local-guided swap"]
      : type === "commute"
      ? ["Faster transit option", "Less crowded transfer", "Scenic route transfer"]
      : ["High-rated alternative", "Nearby local favorite", "Low-wait backup option"];
  return `${options[(nextIndex - 1) % options.length]} • ${destination}`;
};

const getDefaultLiveState = (): ActivityLiveState => ({
  status: "pending",
  delayMinutes: 0,
  replacementIndex: 0,
  updatedAt: Date.now(),
});

export default function TripLiveMode({ tripId, destination, days }: Props) {
  const sortedDays = useMemo(
    () => [...days].sort((a, b) => a.day_number - b.day_number),
    [days]
  );
  const [selectedDay, setSelectedDay] = useState<number>(sortedDays[0]?.day_number || 1);
  const [stateByDay, setStateByDay] = useState<PersistedState>({});
  const [hydrated, setHydrated] = useState(false);

  const storageKey = `rahi-live:${STORAGE_VERSION}:${tripId}`;

  useEffect(() => {
    setSelectedDay((current) => {
      if (sortedDays.some((day) => day.day_number === current)) return current;
      return sortedDays[0]?.day_number || 1;
    });
  }, [sortedDays]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as PersistedState;
      setStateByDay(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setStateByDay({});
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(stateByDay));
  }, [hydrated, stateByDay, storageKey]);

  const selectedDayData = sortedDays.find((day) => day.day_number === selectedDay) || sortedDays[0];
  const selectedDayActivities = useMemo(
    () =>
      [...(selectedDayData?.activities || [])].sort(
        (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
      ),
    [selectedDayData]
  );
  const dayState = stateByDay[String(selectedDay)] || {};

  const updateActivityState = (
    activityKey: string,
    updater: (current: ActivityLiveState) => ActivityLiveState
  ) => {
    setStateByDay((prev) => {
      const dayKey = String(selectedDay);
      const existingDayState = prev[dayKey] || {};
      const current = existingDayState[activityKey] || getDefaultLiveState();
      return {
        ...prev,
        [dayKey]: {
          ...existingDayState,
          [activityKey]: updater(current),
        },
      };
    });
  };

  const resetActivity = (activityKey: string) => {
    setStateByDay((prev) => {
      const dayKey = String(selectedDay);
      const existingDayState = { ...(prev[dayKey] || {}) };
      delete existingDayState[activityKey];
      return {
        ...prev,
        [dayKey]: existingDayState,
      };
    });
  };

  const timeline = useMemo(() => {
    let cursor = 9 * 60;
    return selectedDayActivities.map((activity, index) => {
      const key = getActivityKey(activity, index, selectedDay);
      const live = dayState[key] || getDefaultLiveState();
      const delay = Math.max(0, live.delayMinutes || 0);
      const duration = Math.max(30, Number(activity.duration_minutes) || 90);
      const start = cursor + delay;
      const end = start + duration;
      cursor = end + 20;
      return {
        key,
        index,
        activity,
        live,
        duration,
        start,
        end,
      };
    });
  }, [dayState, selectedDay, selectedDayActivities]);

  const dayStats = useMemo(() => {
    const total = timeline.length;
    const done = timeline.filter((item) => item.live.status === "done").length;
    const skipped = timeline.filter((item) => item.live.status === "skipped").length;
    const pending = Math.max(0, total - done - skipped);
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    const nextUp = timeline.find((item) => item.live.status === "pending") || null;
    return { total, done, skipped, pending, percent, nextUp };
  }, [timeline]);

  const dayCounts = useMemo(() => {
    const map = new Map<number, { done: number; total: number }>();
    sortedDays.forEach((day) => {
      const activities = [...(day.activities || [])].sort(
        (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
      );
      const dayKey = String(day.day_number);
      const currentDayState = stateByDay[dayKey] || {};
      const total = activities.length;
      const done = activities.reduce((count, activity, index) => {
        const key = getActivityKey(activity, index, day.day_number);
        const state = currentDayState[key];
        return state?.status === "done" ? count + 1 : count;
      }, 0);
      map.set(day.day_number, { done, total });
    });
    return map;
  }, [sortedDays, stateByDay]);

  if (!selectedDayData) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/25 p-5 text-sm text-gray-400">
        No day plan available yet. Generate a trip first and reopen Live Day Mode.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-teal-200">Live Day Mode</p>
            <h2 className="mt-1 text-2xl font-display font-bold text-white">Day {selectedDay}</h2>
            <p className="mt-1 text-xs text-gray-400">
              {selectedDayData.summary || `Move through ${destination} with live adjustments.`}
            </p>
          </div>
          <div className="min-w-[210px] rounded-xl border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-gray-400">Progress</p>
            <div className="mt-1 text-xl font-bold text-white">{dayStats.percent}%</div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 transition-all"
                style={{ width: `${dayStats.percent}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-gray-400">
              {dayStats.done} done • {dayStats.pending} pending • {dayStats.skipped} skipped
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {sortedDays.map((day) => {
            const counts = dayCounts.get(day.day_number) || { done: 0, total: 0 };
            const active = day.day_number === selectedDay;
            return (
              <button
                key={`day-tab-${day.day_number}`}
                type="button"
                onClick={() => setSelectedDay(day.day_number)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-left transition ${
                  active
                    ? "border-teal-300/50 bg-teal-500/15 text-white"
                    : "border-white/10 bg-black/25 text-gray-300 hover:border-teal-400/40"
                }`}
              >
                <p className="text-xs font-semibold">Day {day.day_number}</p>
                <p className="text-[10px] text-gray-400">
                  {counts.done}/{counts.total} done
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
          State sync: local on this device (offline friendly). You can continue even with unstable network.
        </div>
      </div>

      {dayStats.nextUp && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-200">Next up</p>
          <p className="mt-1 text-base font-semibold text-white">
            {dayStats.nextUp.live.replacementTitle || dayStats.nextUp.activity.title || "Activity"}
          </p>
          <p className="mt-1 text-xs text-emerald-100/90">
            Starts around {formatTime(dayStats.nextUp.start)} • {dayStats.nextUp.duration} min
          </p>
        </div>
      )}

      <div className="space-y-3">
        {timeline.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-400">
            No activities planned for this day.
          </div>
        )}

        {timeline.map((item) => {
          const locationName = item.activity.location?.name || "Location pending";
          const cost = Number(item.activity.estimated_cost) || 0;
          const originalTitle = item.activity.title || "Untitled activity";
          const title = item.live.replacementTitle || originalTitle;

          const statusTone =
            item.live.status === "done"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : item.live.status === "skipped"
                ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                : "border-cyan-400/30 bg-cyan-500/10 text-cyan-200";

          return (
            <article
              key={item.key}
              className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 shadow-[0_20px_45px_-35px_rgba(34,211,238,0.55)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-gray-300">
                      {formatTime(item.start)} - {formatTime(item.end)}
                    </span>
                    <span className={`rounded-full border px-2 py-1 text-[10px] ${statusTone}`}>
                      {item.live.status}
                    </span>
                    {item.live.delayMinutes > 0 && (
                      <span className="rounded-full border border-orange-400/30 bg-orange-500/10 px-2 py-1 text-[10px] text-orange-200">
                        +{item.live.delayMinutes}m delay
                      </span>
                    )}
                    {item.live.replacementTitle && (
                      <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-200">
                        replaced
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
                  {item.live.replacementTitle && (
                    <p className="text-[11px] text-gray-500 line-through">{originalTitle}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-teal-300/70" />
                      {locationName}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5 text-cyan-300/70" />
                      {item.duration} min
                    </span>
                    <span>₹{formatCurrency(cost)}</span>
                  </div>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    locationName
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rahi-btn-ghost text-[11px]"
                >
                  <LocateFixed className="h-3.5 w-3.5" />
                  Navigate
                </a>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() =>
                    updateActivityState(item.key, (current) => ({
                      ...current,
                      status: current.status === "done" ? "pending" : "done",
                      updatedAt: Date.now(),
                    }))
                  }
                  className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs ${
                    item.live.status === "done"
                      ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-100"
                      : "border-white/10 bg-white/5 text-gray-200 hover:border-emerald-400/40"
                  }`}
                >
                  {item.live.status === "done" ? (
                    <>
                      <Undo2 className="h-3.5 w-3.5" />
                      Undo
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Done
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateActivityState(item.key, (current) => ({
                      ...current,
                      delayMinutes: Math.min(240, (current.delayMinutes || 0) + 30),
                      updatedAt: Date.now(),
                    }))
                  }
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-gray-200 hover:border-orange-400/40"
                >
                  <Clock3 className="h-3.5 w-3.5" />
                  Delay 30m
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateActivityState(item.key, (current) => ({
                      ...current,
                      status: current.status === "skipped" ? "pending" : "skipped",
                      updatedAt: Date.now(),
                    }))
                  }
                  className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs ${
                    item.live.status === "skipped"
                      ? "border-amber-400/40 bg-amber-500/20 text-amber-100"
                      : "border-white/10 bg-white/5 text-gray-200 hover:border-amber-400/40"
                  }`}
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  {item.live.status === "skipped" ? "Unskip" : "Skip"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateActivityState(item.key, (current) => {
                      const nextIndex = (current.replacementIndex || 0) + 1;
                      return {
                        ...current,
                        replacementIndex: nextIndex,
                        replacementTitle: getReplacementTitle(
                          item.activity,
                          destination,
                          nextIndex
                        ),
                        updatedAt: Date.now(),
                      };
                    })
                  }
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-gray-200 hover:border-violet-400/40"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Replace
                </button>
              </div>

              {(item.live.status !== "pending" ||
                item.live.delayMinutes > 0 ||
                Boolean(item.live.replacementTitle)) && (
                <button
                  type="button"
                  onClick={() => resetActivity(item.key)}
                  className="mt-2 text-[11px] text-gray-400 hover:text-gray-200"
                >
                  Reset activity state
                </button>
              )}
            </article>
          );
        })}
      </div>

      {!hydrated && (
        <p className="text-xs text-gray-500">Loading local live state...</p>
      )}
    </div>
  );
}

