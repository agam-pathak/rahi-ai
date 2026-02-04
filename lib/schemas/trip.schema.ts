import { z } from "zod";

/* ---------- Enums ---------- */

export const ActivityType = z.enum([
  "sightseeing",
  "food",
  "transit",
  "rest",
  "experience",
]);

export const VerificationLevel = z.enum([
  "ai_estimated",
  "api_verified",
]);

export const PaceLevel = z.enum([
  "relaxed",
  "balanced",
  "packed",
]);

export const VibeTag = z.enum([
  "high_energy",
  "chill",
  "cultural",
  "nature",
  "nightlife",
  "budget_friendly",
]);

/* ---------- Atomic Schemas ---------- */

export const LocationSchema = z.object({
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  place_id: z.string().optional(),
});

export const ActivitySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  type: ActivityType,

  location: LocationSchema,

  estimated_cost: z.number().nonnegative(),
  duration_minutes: z.number().positive(),

  verification: VerificationLevel,
  tags: z.array(VibeTag),

  order_index: z.number(),
});

export const DaySchema = z.object({
  day_number: z.number().int().positive(),
  summary: z.string(),
  activities: z.array(ActivitySchema),
});

export const TripMetaSchema = z.object({
  total_estimated_budget: z.number().nonnegative(),
  pace: PaceLevel,
  primary_vibes: z.array(VibeTag),
});

/* ---------- Canonical Trip ---------- */

export const TripSchema = z.object({
  id: z.string().uuid(),

  destination: z.string(),
  days_count: z.number().int().positive(),

  days: z.array(DaySchema),
  meta: TripMetaSchema,

  generated_at: z.string().datetime(),
});

export type Trip = z.infer<typeof TripSchema>;
