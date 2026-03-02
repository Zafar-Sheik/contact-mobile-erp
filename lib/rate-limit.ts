// Simple in-memory rate limiter for Vercel/serverless
// Note: In production, use Redis or similar for distributed rate limiting

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits.entries()) {
    if (entry.resetAt < now) {
      rateLimits.delete(key);
    }
  }
}, 60 * 1000); // Clean every minute

/**
 * Check if request should be rate limited
 * @param key - Identifier (IP, email, etc.)
 * @param limit - Max requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns true if rate limited, false if allowed
 */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);
  
  if (!entry || entry.resetAt < now) {
    // First request or window expired
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  
  if (entry.count >= limit) {
    // Rate limited
    return true;
  }
  
  // Increment count
  entry.count++;
  return false;
}

/**
 * Get rate limit info for response headers
 */
export function getRateLimitInfo(key: string, limit: number, windowMs: number) {
  const entry = rateLimits.get(key);
  const now = Date.now();
  
  if (!entry || entry.resetAt < now) {
    return { remaining: limit, reset: new Date(now + windowMs).toISOString() };
  }
  
  return { 
    remaining: Math.max(0, limit - entry.count), 
    reset: new Date(entry.resetAt).toISOString() 
  };
}
