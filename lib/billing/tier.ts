export type PlanTier = "free" | "basic" | "premium" | "pro";
export type TrialStatus = "none" | "active" | "expired";

const TIER_RANK: Record<PlanTier, number> = {
  free: 0,
  basic: 1,
  premium: 2,
  pro: 3,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const normalizePlanTier = (value: unknown): PlanTier | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "free" ||
    normalized === "basic" ||
    normalized === "premium" ||
    normalized === "pro"
  ) {
    return normalized;
  }
  return null;
};

export const isPaidTier = (tier: PlanTier) =>
  tier === "premium" || tier === "pro";

export const isProTier = (tier: PlanTier) => tier === "pro";

export const tierAtLeast = (tier: PlanTier, minimum: PlanTier) =>
  TIER_RANK[tier] >= TIER_RANK[minimum];

export const computeTrialWindow = (
  createdAt: string | null | undefined,
  trialDaysInput = 14
) => {
  const trialDays = Number.isFinite(trialDaysInput) && trialDaysInput > 0
    ? Math.floor(trialDaysInput)
    : 14;
  if (!createdAt) {
    return {
      trialStatus: "none" as TrialStatus,
      trialActive: false,
      trialDaysLeft: 0,
      trialEndsAt: null as string | null,
      trialDays,
    };
  }

  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) {
    return {
      trialStatus: "none" as TrialStatus,
      trialActive: false,
      trialDaysLeft: 0,
      trialEndsAt: null as string | null,
      trialDays,
    };
  }

  const trialEndsMs = createdMs + trialDays * DAY_MS;
  const nowMs = Date.now();
  const remainingMs = trialEndsMs - nowMs;
  const trialActive = remainingMs > 0;
  const trialDaysLeft = trialActive ? Math.ceil(remainingMs / DAY_MS) : 0;

  return {
    trialStatus: (trialActive ? "active" : "expired") as TrialStatus,
    trialActive,
    trialDaysLeft,
    trialEndsAt: new Date(trialEndsMs).toISOString(),
    trialDays,
  };
};

export const resolvePlanTier = ({
  explicitTier,
  isPremium,
  trialActive,
}: {
  explicitTier: unknown;
  isPremium: boolean;
  trialActive: boolean;
}): PlanTier => {
  const normalized = normalizePlanTier(explicitTier);
  if (normalized === "pro") return "pro";
  if (normalized === "premium") return "premium";
  if (isPremium) return "premium";
  if (normalized === "basic") return "basic";
  if (normalized === "free") return "free";
  if (trialActive) return "basic";
  return "free";
};

export const getPlanCapabilities = (tier: PlanTier) => ({
  privateSharing: tierAtLeast(tier, "premium"),
  premiumPdf: tierAtLeast(tier, "premium"),
  premiumInsights: tierAtLeast(tier, "premium"),
  signaturePlans: tierAtLeast(tier, "premium"),
  routeOptimization: tierAtLeast(tier, "premium"),
  dayOptimization: isProTier(tier),
  activitySwap: isProTier(tier),
});
