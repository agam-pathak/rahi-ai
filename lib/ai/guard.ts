type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

type RateLimitState = {
  count: number;
  reset: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  reset: number;
};

const buckets = new Map<string, RateLimitState>();

export function getClientId(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now > existing.reset) {
    const reset = now + config.windowMs;
    buckets.set(key, { count: 1, reset });
    return {
      allowed: true,
      remaining: config.limit - 1,
      reset,
    };
  }

  existing.count += 1;
  buckets.set(key, existing);

  return {
    allowed: existing.count <= config.limit,
    remaining: Math.max(config.limit - existing.count, 0),
    reset: existing.reset,
  };
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
  };
}

export function logAiRequest(route: string, clientId: string, detail: Record<string, unknown>) {
  try {
    console.info(`[ai] ${route} ip=${clientId} detail=${JSON.stringify(detail)}`);
  } catch {
    console.info(`[ai] ${route} ip=${clientId}`);
  }
}
