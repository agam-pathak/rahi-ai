"use client";

import type { DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Clock,
  FoldVertical,
  GripVertical,
  MapPin,
  RefreshCw,
  Shuffle,
  UnfoldVertical,
} from "lucide-react";

type Location = {
  name?: string;
  lat?: number;
  lng?: number;
};

type Activity = {
  id: string;
  title: string;
  location?: Location;
  estimated_cost: number;
  order_index: number;
  type?: string;
  duration_minutes?: number;
  tags?: string[];
};

type DayPlan = {
  day_number: number;
  activities: Activity[];
  summary?: string;
};

type TripMeta = {
  total_estimated_budget?: number;
  pace?: "relaxed" | "balanced" | "packed";
  primary_vibes?: string[];
};

export type TripItineraryData = {
  destination: string;
  days: DayPlan[];
  meta?: TripMeta;
};

type Props = {
  trip: TripItineraryData;
  showSummary?: boolean;
  loadingDay?: number | null;
  loadingActivityId?: string | null;
  onRegenerateDay?: (dayNumber: number) => void;
  onReplaceActivity?: (dayNumber: number, activityId: string) => void;
  onReorderActivity?: (dayNumber: number, fromIndex: number, toIndex: number) => void;
};

const formatCurrency = (value: number) => {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-IN");
};

const formatDuration = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  const whole = Number.isInteger(hours);
  return `${whole ? hours.toFixed(0) : hours.toFixed(1)}h`;
};

const formatTime = (minutes: number) => {
  const hrs24 = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  const period = hrs24 >= 12 ? "PM" : "AM";
  const hrs12 = hrs24 % 12 === 0 ? 12 : hrs24 % 12;
  const padded = mins.toString().padStart(2, "0");
  return `${hrs12}:${padded} ${period}`;
};

const buildSchedule = (activities: Activity[]) => {
  let cursor = 9 * 60;
  return activities.map((activity, index) => {
    const duration = Number(activity.duration_minutes) || 90;
    const start = cursor;
    const end = start + duration;
    cursor = end + 30;
    return { activity, index, start, end };
  });
};

export default function TripItinerary({
  trip,
  showSummary = true,
  loadingDay,
  loadingActivityId,
  onRegenerateDay,
  onReplaceActivity,
  onReorderActivity,
}: Props) {
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [collapsedDays, setCollapsedDays] = useState<Record<number, boolean>>({});
  const dragRef = useRef<{ dayNumber: number; fromIndex: number } | null>(null);

  const orderedDays = useMemo(() => {
    return [...(trip.days ?? [])].sort((a, b) => a.day_number - b.day_number);
  }, [trip.days]);

  useEffect(() => {
    setCollapsedDays((prev) => {
      const next: Record<number, boolean> = {};
      const firstDay = orderedDays[0]?.day_number;
      orderedDays.forEach((day) => {
        next[day.day_number] = prev[day.day_number] ?? day.day_number !== firstDay;
      });
      return next;
    });
  }, [orderedDays]);

  const handleDragStart = (dayNumber: number, index: number) => (event: DragEvent) => {
    if (!onReorderActivity) return;
    dragRef.current = { dayNumber, fromIndex: index };
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (event: DragEvent) => {
    if (!onReorderActivity) return;
    event.preventDefault();
  };

  const handleDrop = (dayNumber: number, index: number) => (event: DragEvent) => {
    if (!onReorderActivity) return;
    event.preventDefault();
    const dragInfo = dragRef.current;
    if (!dragInfo || dragInfo.dayNumber !== dayNumber) return;
    if (dragInfo.fromIndex === index) return;
    onReorderActivity(dayNumber, dragInfo.fromIndex, index);
    dragRef.current = null;
  };

  const toggleDay = (dayNumber: number) => {
    setCollapsedDays((prev) => ({
      ...prev,
      [dayNumber]: !prev[dayNumber],
    }));
  };

  const expandAllDays = () => {
    setCollapsedDays((prev) => {
      const next = { ...prev };
      orderedDays.forEach((day) => {
        next[day.day_number] = false;
      });
      return next;
    });
  };

  const collapseAllDays = () => {
    setCollapsedDays((prev) => {
      const next = { ...prev };
      orderedDays.forEach((day) => {
        next[day.day_number] = true;
      });
      return next;
    });
  };

  const dayCount = orderedDays.length;
  const totalFromActivities = orderedDays.reduce((sum, day) => {
    const daySum = day.activities.reduce(
      (acc, activity) => acc + (Number(activity.estimated_cost) || 0),
      0
    );
    return sum + daySum;
  }, 0);
  const totalFromMeta = trip.meta?.total_estimated_budget ?? 0;
  const totalCost = totalFromMeta > 0 ? totalFromMeta : totalFromActivities;
  const avgPerDay = dayCount > 0 ? Math.round(totalCost / dayCount) : 0;
  const vibes = trip.meta?.primary_vibes ?? [];
  const totalActivities = orderedDays.reduce((sum, day) => sum + day.activities.length, 0);

  return (
    <div className="space-y-5">
      {showSummary && (
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#112447]/55 via-[#0f1d38]/60 to-[#0d182f]/75 shadow-[0_24px_70px_-52px_rgba(38,240,216,0.55)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-teal-300/90">Trip Overview</p>
              <p className="text-xs text-gray-400">{totalActivities} activities across {dayCount} days</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOverviewOpen((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-gray-200 hover:bg-white/10"
              >
                <ChevronsUpDown className="h-3.5 w-3.5 text-teal-300" />
                {overviewOpen ? "Fold Overview" : "Expand Overview"}
              </button>
              <button
                type="button"
                onClick={expandAllDays}
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-gray-200 hover:bg-white/10"
              >
                <UnfoldVertical className="h-3.5 w-3.5 text-teal-300" />
                Expand Days
              </button>
              <button
                type="button"
                onClick={collapseAllDays}
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-gray-200 hover:bg-white/10"
              >
                <FoldVertical className="h-3.5 w-3.5 text-teal-300" />
                Fold Days
              </button>
            </div>
          </div>
          {overviewOpen && (
            <div className="grid grid-cols-2 gap-3 p-4 xl:grid-cols-4">
              <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3">
                <p className="text-[11px] text-cyan-200/90">Total Estimated</p>
                <p className="text-xl font-semibold text-white">₹{formatCurrency(totalCost)}</p>
              </div>
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3">
                <p className="text-[11px] text-emerald-200/90">Avg / Day</p>
                <p className="text-xl font-semibold text-white">₹{formatCurrency(avgPerDay)}</p>
              </div>
              <div className="rounded-xl border border-violet-400/20 bg-violet-500/5 p-3">
                <p className="text-[11px] text-violet-200/90">Pace</p>
                <p className="text-xl font-semibold capitalize text-white">
                  {trip.meta?.pace ?? "balanced"}
                </p>
              </div>
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-3">
                <p className="text-[11px] text-amber-200/90">Primary Vibes</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(vibes.length > 0 ? vibes : ["curated"]).slice(0, 3).map((vibe) => (
                    <span
                      key={vibe}
                      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-amber-100"
                    >
                      {vibe.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {orderedDays.map((day) => {
        const orderedActivities = [...day.activities].sort((a, b) => a.order_index - b.order_index);
        const dayTotal = day.activities.reduce(
          (sum, activity) => sum + (Number(activity.estimated_cost) || 0),
          0
        );
        const totalDuration = orderedActivities.reduce(
          (sum, activity) => sum + (Number(activity.duration_minutes) || 90),
          0
        );
        const isCollapsed = collapsedDays[day.day_number] ?? false;
        const preview = orderedActivities.slice(0, 3);
        const hiddenCount = Math.max(orderedActivities.length - preview.length, 0);
        const highlight =
          day.day_number % 3 === 1
            ? "from-teal-400/10 via-transparent to-transparent"
            : day.day_number % 3 === 2
              ? "from-cyan-400/10 via-transparent to-transparent"
              : "from-indigo-400/10 via-transparent to-transparent";

        return (
          <div
            key={day.day_number}
            className={`overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${highlight} from-[#101f3f]/92 via-[#0d1b35]/90 to-[#0a1328]/95 shadow-[0_24px_80px_-56px_rgba(25,200,180,0.65)]`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-2xl font-bold text-teal-300">Day {day.day_number}</h3>
                  <span className="rounded-full border border-white/15 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-300">
                    {orderedActivities.length} stops
                  </span>
                  <span className="rounded-full border border-white/15 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-300">
                    {formatDuration(totalDuration)}
                  </span>
                  <span className="rounded-full border border-white/15 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-300">
                    ₹{formatCurrency(dayTotal)}
                  </span>
                </div>
                {typeof day.summary === "string" && (
                  <p className="mt-1 text-xs text-gray-400">{day.summary}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {onRegenerateDay && (
                  <button
                    type="button"
                    onClick={() => onRegenerateDay(day.day_number)}
                    disabled={loadingDay === day.day_number}
                    className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-teal-200 hover:bg-white/10 disabled:opacity-50"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {loadingDay === day.day_number ? "Regenerating..." : "Regenerate Day"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggleDay(day.day_number)}
                  className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/10"
                >
                  {isCollapsed ? (
                    <>
                      <ChevronDown className="h-3.5 w-3.5 text-teal-300" />
                      Expand
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-3.5 w-3.5 text-teal-300" />
                      Fold
                    </>
                  )}
                </button>
              </div>
            </div>

            {isCollapsed ? (
              <div className="px-4 pb-4 pt-3">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  {preview.length === 0 ? (
                    <p className="text-xs text-gray-400">No activities available for this day.</p>
                  ) : (
                    <>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Quick view</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {preview.map((activity) => (
                          <span
                            key={activity.id}
                            className="rounded-full border border-teal-400/25 bg-teal-500/10 px-3 py-1 text-xs text-teal-100"
                          >
                            {activity.title}
                          </span>
                        ))}
                        {hiddenCount > 0 && (
                          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-gray-300">
                            +{hiddenCount} more
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="px-4 pb-4 pt-3">
                {orderedActivities.length === 0 ? (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-gray-400">
                    No activities available for this day.
                  </div>
                ) : (
                  <div className="relative pl-6 sm:pl-10">
                    <div className="absolute left-3 sm:left-4 top-2 bottom-2 w-px bg-white/10" />
                    <div className="space-y-4">
                      {buildSchedule(orderedActivities).map(({ activity, index, start, end }) => (
                        <div
                          key={activity.id || `${day.day_number}-${index}`}
                          className="relative flex gap-4"
                          draggable={Boolean(onReorderActivity)}
                          onDragStart={handleDragStart(day.day_number, index)}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop(day.day_number, index)}
                          onDragEnd={() => {
                            dragRef.current = null;
                          }}
                        >
                          <div className="w-12 sm:w-16 text-right text-[10px] text-gray-400">
                            <div>{formatTime(start)}</div>
                            <div className="text-gray-600">{formatTime(end)}</div>
                          </div>

                          <div className="relative flex-1">
                            <span className="absolute -left-6 top-4 h-2.5 w-2.5 rounded-full bg-teal-400 shadow-[0_0_0_5px_rgba(38,240,216,0.2)]" />
                            <div className="flex items-start justify-between rounded-xl border border-white/8 bg-black/20 p-3.5 transition hover:bg-black/30">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  {onReorderActivity && (
                                    <GripVertical className="h-4 w-4 cursor-grab text-gray-500" />
                                  )}
                                  <span className="text-[10px] font-mono text-gray-500">#{index + 1}</span>
                                  <h4 className="truncate text-[17px] font-semibold text-white">{activity.title}</h4>
                                </div>
                                <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                                  <MapPin className="h-3 w-3 text-teal-500/75" />
                                  {activity.location?.name || "Unknown"}
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
                                  {activity.type && (
                                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 uppercase tracking-wide">
                                      {activity.type}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-teal-400/70" />
                                    {Number(activity.duration_minutes) || 90} min
                                  </span>
                                  {Array.isArray(activity.tags) &&
                                    activity.tags.length > 0 &&
                                    activity.tags.slice(0, 3).map((tag) => (
                                      <span
                                        key={tag}
                                        className="rounded-full border border-teal-400/20 bg-teal-500/10 px-2 py-0.5 text-[10px] text-teal-300"
                                      >
                                        {tag.replace(/_/g, " ")}
                                      </span>
                                    ))}
                                </div>
                              </div>
                              <div className="ml-3 flex flex-col items-end gap-2">
                                <span className="rounded border border-teal-500/20 bg-teal-500/10 px-2 py-1 font-mono text-xs text-teal-300">
                                  ₹{formatCurrency(Number(activity.estimated_cost) || 0)}
                                </span>
                                {onReplaceActivity && (
                                  <button
                                    type="button"
                                    onClick={() => onReplaceActivity(day.day_number, activity.id)}
                                    disabled={loadingActivityId === activity.id}
                                    className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-emerald-200 hover:bg-white/10 disabled:opacity-50"
                                  >
                                    <Shuffle className="h-3 w-3" />
                                    {loadingActivityId === activity.id ? "Replacing..." : "Replace"}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
