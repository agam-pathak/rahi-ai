import type { Activity, DayPlan, Trip } from "./types";

export const parseBudget = (value: string) => {
  const cleaned = value.replace(/,/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
};

export const formatCurrency = (value: number) => {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-IN");
};

export const createLocalId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const getActivityCoord = (activity: Activity) => {
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

export const haversineKm = (from: [number, number], to: [number, number]) => {
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

export const computeTotalBudget = (days: DayPlan[]) => {
  return days.reduce((sum, day) => {
    const dayTotal = day.activities.reduce(
      (acc, activity) => acc + (Number(activity.estimated_cost) || 0),
      0
    );
    return sum + dayTotal;
  }, 0);
};

export const applyBudgetToTrip = (inputTrip: Trip): Trip => {
  const total = computeTotalBudget(inputTrip.days);
  return {
    ...inputTrip,
    meta: {
      ...inputTrip.meta,
      total_estimated_budget: total,
    },
  };
};

const WORD_NUMBER_MAP: Record<string, number> = {
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

const wordToNumber = (value: string) => {
  if (!value) return null;
  const key = value.toLowerCase();
  return WORD_NUMBER_MAP[key] ?? null;
};

export const parseNumberToken = (token?: string | null) => {
  if (!token) return null;
  if (/^\d+$/.test(token)) return Number(token);
  const word = wordToNumber(token);
  return word ?? null;
};

export const parseDayNumber = (text: string) => {
  const match =
    text.match(
      /day\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third)/i
    ) ||
    text.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*day/i);
  return parseNumberToken(match?.[1]);
};

export const parseActivityIndex = (text: string) => {
  const match =
    text.match(
      /activity\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third)/i
    ) ||
    text.match(
      /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third)\s+activity/i
    );
  const index = parseNumberToken(match?.[1]);
  return index ? index - 1 : null;
};
