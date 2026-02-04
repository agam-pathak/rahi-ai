"use client";

import type { DragEvent } from "react";
import { useRef } from "react";
import { Clock, GripVertical, MapPin, RefreshCw, Shuffle } from "lucide-react";

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
  const dragRef = useRef<{ dayNumber: number; fromIndex: number } | null>(null);

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
  const dayCount = trip.days?.length ?? 0;
  const totalFromActivities = trip.days?.reduce((sum, day) => {
    const daySum = day.activities.reduce(
      (acc, activity) => acc + (Number(activity.estimated_cost) || 0),
      0
    );
    return sum + daySum;
  }, 0) ?? 0;
  const totalFromMeta = trip.meta?.total_estimated_budget ?? 0;
  const totalCost = totalFromMeta > 0 ? totalFromMeta : totalFromActivities;
  const avgPerDay = dayCount > 0 ? Math.round(totalCost / dayCount) : 0;
  const vibes = trip.meta?.primary_vibes ?? [];

  return (
    <div className="space-y-6">
      {showSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-gray-400">Total Estimated</p>
            <p className="text-lg font-semibold text-white">
              ₹{formatCurrency(totalCost)}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-gray-400">Avg / Day</p>
            <p className="text-lg font-semibold text-white">
              ₹{formatCurrency(avgPerDay)}
            </p>
          </div>
          {trip.meta?.pace && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-gray-400">Pace</p>
              <p className="text-lg font-semibold text-white capitalize">
                {trip.meta.pace}
              </p>
            </div>
          )}
          {vibes.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-gray-400">Primary Vibes</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {vibes.slice(0, 3).map((vibe) => (
                  <span
                    key={vibe}
                    className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold text-teal-300"
                  >
                    {vibe.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {trip.days?.map((day) => {
        const dayTotal = day.activities.reduce(
          (sum, activity) => sum + (Number(activity.estimated_cost) || 0),
          0
        );

        return (
          <div key={day.day_number} className="bg-white/5 rounded-xl border border-white/5 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-2">
              <div className="flex flex-col gap-1">
                <h3 className="font-bold text-teal-400 text-lg">
                  Day {day.day_number}
                </h3>
                {typeof day.summary === "string" && (
                  <p className="text-xs text-gray-500">
                    {day.summary}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">
                  ₹{formatCurrency(dayTotal)}
                </span>
                {onRegenerateDay && (
                  <button
                    onClick={() => onRegenerateDay(day.day_number)}
                    disabled={loadingDay === day.day_number}
                    className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-teal-200 hover:bg-white/10 disabled:opacity-50"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {loadingDay === day.day_number ? "Regenerating..." : "Regenerate Day"}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {day.activities.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-gray-400">
                  No activities available for this day.
                </div>
              ) : (
                <div className="relative pl-10">
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-white/10" />
                  <div className="space-y-4">
                    {buildSchedule(
                      [...day.activities].sort((a, b) => a.order_index - b.order_index)
                    ).map(({ activity, index, start, end }) => (
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
                        <div className="w-16 text-right text-[10px] text-gray-400">
                          <div>{formatTime(start)}</div>
                          <div className="text-gray-600">{formatTime(end)}</div>
                        </div>

                        <div className="relative flex-1">
                          <span className="absolute -left-6 top-4 h-2 w-2 rounded-full bg-teal-400" />
                          <div className="flex justify-between items-start bg-black/20 p-3 rounded-lg hover:bg-black/30 transition">
                            <div>
                              <div className="flex items-center gap-2">
                                {onReorderActivity && (
                                  <GripVertical className="h-4 w-4 text-gray-500 cursor-grab" />
                                )}
                                <span className="text-[10px] text-gray-500 font-mono">
                                  #{index + 1}
                                </span>
                                <h4 className="font-semibold text-white text-sm">
                                  {activity.title}
                                </h4>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 text-gray-400 text-xs">
                                <MapPin className="w-3 h-3 text-teal-500/70" />
                                {activity.location?.name || "Unknown"}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
                                {activity.type && (
                                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 uppercase tracking-wide">
                                    {activity.type}
                                  </span>
                                )}
                                {activity.duration_minutes && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-teal-400/70" />
                                    {activity.duration_minutes} min
                                  </span>
                                )}
                                {Array.isArray(activity.tags) && activity.tags.length > 0 && (
                                  activity.tags.slice(0, 3).map((tag) => (
                                    <span
                                      key={tag}
                                      className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] text-teal-300"
                                    >
                                      {tag.replace(/_/g, " ")}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className="text-xs font-mono bg-teal-500/10 text-teal-300 px-2 py-1 rounded border border-teal-500/20">
                                ₹{formatCurrency(Number(activity.estimated_cost) || 0)}
                              </span>
                              {onReplaceActivity && (
                                <button
                                  onClick={() => onReplaceActivity(day.day_number, activity.id)}
                                  disabled={loadingActivityId === activity.id}
                                  className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-emerald-200 hover:bg-white/10 disabled:opacity-50"
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
          </div>
        );
      })}
    </div>
  );
}
