// In-memory rate limiter for authentication endpoints.
// Keyed by IP address or token. Resets on server restart.
// For multi-replica production deployments, replace with a Redis-backed solution.

const authLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkAuthRateLimit(
  identifier: string,
  maxRequests = 5,
  windowMs = 15 * 60 * 1000,
): { allowed: boolean; retryAfter?: number } {
  const now   = Date.now();
  const entry = authLimitMap.get(identifier);

  if (!entry || entry.resetAt <= now) {
    authLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed:    false,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count++;
  return { allowed: true };
}
