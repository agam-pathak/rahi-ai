import { randomBytes } from "crypto";

const ALLOWED_TYPES = [
  "sightseeing",
  "food",
  "transit",
  "rest",
  "experience",
];

const ALLOWED_TAGS = [
  "high_energy",
  "chill",
  "cultural",
  "nature",
  "nightlife",
  "budget_friendly",
];

const ALLOWED_VIBES = [
  "high_energy",
  "chill",
  "cultural",
  "nature",
  "nightlife",
  "budget_friendly",
];

const VIBE_MAP: Record<string, string> = {
  food: "cultural",
  exploration: "high_energy",
  spiritual: "cultural",
  history: "cultural",
  relaxing: "chill",
  party: "nightlife",
  cheap: "budget_friendly",
  budget: "budget_friendly",
};

const uuidv4 = () => globalThis.crypto.randomUUID();

export function generateShareCode() {
  return `RAHI-${randomBytes(8).toString("hex").toUpperCase()}`;
}

export async function generateUniqueShareCode(
  isAvailable: (code: string) => Promise<boolean>,
  attempts = 6
) {
  for (let i = 0; i < attempts; i += 1) {
    const code = generateShareCode();
    if (await isAvailable(code)) {
      return code;
    }
  }
  throw new Error("Failed to generate unique share code");
}

export function extractJSON(text: string) {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No JSON found in AI response");
  }
  return text.slice(firstBrace, lastBrace + 1);
}

export function normalizeMeta(meta: any) {
  if (!meta || typeof meta !== "object") {
    return {
      total_estimated_budget: 0,
      pace: "balanced",
      primary_vibes: ["cultural"],
    };
  }

  const allowedPaces = ["relaxed", "balanced", "packed"];
  const pace =
    allowedPaces.includes(meta.pace) ? meta.pace : "balanced";

  let vibes = Array.isArray(meta.primary_vibes) ? meta.primary_vibes : [];

  vibes = vibes
    .map((v: string) => VIBE_MAP[v] || v)
    .filter((v: string) => ALLOWED_VIBES.includes(v));

  if (vibes.length === 0) {
    vibes = ["cultural"];
  }

  const totalBudget = Number(meta.total_estimated_budget);

  return {
    total_estimated_budget:
      Number.isFinite(totalBudget) && totalBudget >= 0 ? totalBudget : 0,
    pace,
    primary_vibes: vibes,
  };
}

export function normalizeTripData(trip: any) {
  if (!trip || typeof trip !== "object") {
    trip = {};
  }

  if (!Array.isArray(trip.days)) {
    trip.days = [];
  }

  trip.days.forEach((day: any) => {
    if (!Array.isArray(day.activities)) {
      day.activities = [];
    }

    day.activities.forEach((act: any) => {
      if (!act.title || typeof act.title !== "string") {
        act.title = "Planned activity";
      }

      if (!act.location || typeof act.location !== "object") {
        act.location = { name: "Unknown", lat: 0, lng: 0 };
      }

      if (!act.location.name || typeof act.location.name !== "string") {
        act.location.name = "Unknown";
      }
      act.location.lat = Number(act.location.lat) || 0;
      act.location.lng = Number(act.location.lng) || 0;

      if (!ALLOWED_TYPES.includes(act.type)) {
        act.type = "sightseeing";
      }

      if (!Array.isArray(act.tags)) {
        act.tags = [];
      }

      act.tags = act.tags.filter((tag: string) =>
        ALLOWED_TAGS.includes(tag)
      );

      if (act.tags.length === 0) {
        act.tags = ["cultural"];
      }

      const cost = Number(act.estimated_cost);
      act.estimated_cost = Number.isFinite(cost) && cost >= 0 ? cost : 0;

      const duration = Number(act.duration_minutes);
      act.duration_minutes =
        Number.isFinite(duration) && duration > 0 ? duration : 90;

      const orderIndex = Number(act.order_index);
      act.order_index =
        Number.isFinite(orderIndex) && orderIndex >= 0 ? orderIndex : 0;
      act.verification = "ai_estimated";
    });
  });

  trip.meta = normalizeMeta(trip.meta);

  return trip;
}

export function injectSystemFields(
  trip: any,
  destination: string,
  days: number
) {
  if (!trip || typeof trip !== "object") {
    trip = {};
  }

  trip.id = uuidv4();
  trip.generated_at = new Date().toISOString();
  trip.destination = destination;
  trip.days_count = Number(days);

  if (!Array.isArray(trip.days)) {
    trip.days = [];
  }

  trip.days.forEach((day: any, dayIndex: number) => {
    day.day_number = dayIndex + 1;
    day.summary ??= `Day ${dayIndex + 1} in ${trip.destination}`;

    if (!Array.isArray(day.activities)) {
      day.activities = [];
    }

    day.activities.forEach((act: any, actIndex: number) => {
      act.id = uuidv4();
      act.order_index ??= actIndex;
      act.verification ??= "ai_estimated";
      act.tags ??= [];
      act.duration_minutes ??= 90;
      act.estimated_cost ??= 0;
      act.type ??= "sightseeing";
    });
  });

  return trip;
}
