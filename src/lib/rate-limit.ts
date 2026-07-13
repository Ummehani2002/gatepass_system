import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const upstashLimiter = hasUpstash
  ? new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      }),
      limiter: Ratelimit.slidingWindow(10, "60 s"),
      prefix: "taskflow:ratelimit",
    })
  : null;

// Single-instance fallback so local dev / single-server deploys still get
// basic brute-force protection without requiring Redis. Not safe across
// multiple instances — set UPSTASH_REDIS_REST_URL/TOKEN in production.
const memoryHits = new Map<string, { count: number; resetAt: number }>();
const MEMORY_LIMIT = 10;
const MEMORY_WINDOW_MS = 60_000;

function memoryRateLimit(key: string) {
  const now = Date.now();
  const entry = memoryHits.get(key);

  if (!entry || entry.resetAt < now) {
    memoryHits.set(key, { count: 1, resetAt: now + MEMORY_WINDOW_MS });
    return { success: true, remaining: MEMORY_LIMIT - 1 };
  }

  entry.count += 1;
  const success = entry.count <= MEMORY_LIMIT;
  return { success, remaining: Math.max(0, MEMORY_LIMIT - entry.count) };
}

/**
 * Rate limit by an arbitrary key (e.g. IP address, "login:<ip>", userId).
 * Returns { success: false } once the caller exceeds 10 requests / 60s.
 */
export async function rateLimit(
  key: string,
): Promise<{ success: boolean; remaining: number }> {
  if (upstashLimiter) {
    const { success, remaining } = await upstashLimiter.limit(key);
    return { success, remaining };
  }
  return memoryRateLimit(key);
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}
