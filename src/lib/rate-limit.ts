// Minimal in-memory fixed-window rate limiter. Sufficient for the single-
// container deployment (Coolify); replace with a shared store if the app is
// ever scaled horizontally. State resets on restart — acceptable for the
// magic-link endpoint this protects.

const hits = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  const windowStart = now - windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (recent.length >= maxRequests) {
    hits.set(key, recent);
    return false;
  }

  recent.push(now);
  hits.set(key, recent);

  // Opportunistic cleanup so the map cannot grow unbounded.
  if (hits.size > 1000) {
    for (const [k, timestamps] of hits) {
      if (timestamps.every((t) => t <= windowStart)) hits.delete(k);
    }
  }
  return true;
}

export function resetRateLimits(): void {
  hits.clear();
}
