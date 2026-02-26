import { type Handle } from "@sveltejs/kit";

/** In-memory store for rate limiting records per client IP */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/** Rate limiting window duration in milliseconds */
const RATE_LIMIT_WINDOW = 2000; // ms
/** Maximum requests allowed per rate limiting window */
export const RATE_LIMIT_MAX_REQUESTS = 20;

/**
 * Extracts the client IP address from request headers
 *
 * Checks headers in order of preference:
 * 1. x-forwarded-for (takes first IP from comma-separated list)
 * 2. x-real-ip
 * 3. Returns 'unknown' if no IP found
 *
 * @param {Request} request - The incoming HTTP request
 * @returns {string} The client IP address or 'unknown'
 */
function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  return "unknown";
}

/**
 * Checks if a client IP is currently rate limited
 *
 * Uses sliding window rate limiting with configurable window size and max requests.
 * Creates or resets rate limit records when window expires.
 *
 * @param {string} clientIP - The client IP address to check
 * @returns {boolean} True if client is rate limited, false otherwise
 */
function isRateLimited(clientIP: string): boolean {
  const now = Date.now();
  const key = clientIP;

  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    // Reset or create new record
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  record.count++;
  return false;
}

/**
 * Clean up limit store every minute
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

/**
 * SvelteKit server hook that handles rate limiting per client IP with configurable limits
 *
 * @param {Object} params - Hook parameters
 * @param {import('@sveltejs/kit').RequestEvent} params.event - The request event
 * @param {Function} params.resolve - Function to resolve the request
 * @returns {Promise<Response>} The response with applied headers and rate limiting
 */
export const rateLimitHandle: Handle = async ({ event, resolve }) => {
  const { request } = event;
  const clientIP = getClientIP(request);

  if (isRateLimited(clientIP)) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": "1",
        "Content-Type": "text/plain",
      },
    });
  }

  const response = await resolve(event);

  return response;
};
