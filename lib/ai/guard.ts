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
const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const redisEnabled = Boolean(redisUrl && redisToken);

let redisWarningLogged = false;

export function getClientId(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

function rateLimitInMemory(key: string, config: RateLimitConfig): RateLimitResult {
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

async function rateLimitWithRedis(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult | null> {
  if (!redisEnabled || !redisUrl || !redisToken) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_500);

  try {
    const res = await fetch(`${redisUrl}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["PEXPIRE", key, String(config.windowMs), "NX"],
        ["PTTL", key],
      ]),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok) {
      if (!redisWarningLogged) {
        console.warn(`[ratelimit] redis unavailable status=${res.status}, falling back to memory`);
        redisWarningLogged = true;
      }
      return null;
    }

    const payload = await res.json();
    const entries = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as any)?.result)
        ? (payload as any).result
        : null;
    if (!entries || entries.length < 3) return null;

    const countRaw = Number(entries[0]?.result);
    const ttlRaw = Number(entries[2]?.result);
    if (!Number.isFinite(countRaw) || countRaw <= 0) return null;

    const ttl = Number.isFinite(ttlRaw) && ttlRaw > 0 ? ttlRaw : config.windowMs;
    const reset = Date.now() + ttl;
    return {
      allowed: countRaw <= config.limit,
      remaining: Math.max(config.limit - countRaw, 0),
      reset,
    };
  } catch (err) {
    if (!redisWarningLogged) {
      console.warn(
        `[ratelimit] redis request failed (${err instanceof Error ? err.message : "unknown"}), falling back to memory`
      );
      redisWarningLogged = true;
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function rateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const distributed = await rateLimitWithRedis(key, config);
  if (distributed) return distributed;
  return rateLimitInMemory(key, config);
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
