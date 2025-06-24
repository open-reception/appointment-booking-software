import { type Handle } from "@sveltejs/kit";
import { logger } from "$lib/logger";

/** In-memory store for rate limiting records per client IP */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/** Rate limiting window duration in milliseconds */
const RATE_LIMIT_WINDOW = 1000; // ms
/** Maximum requests allowed per rate limiting window */
const RATE_LIMIT_MAX_REQUESTS = 10;

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
 * SvelteKit server hook that handles CORS, security headers, and rate limiting
 *
 * Functionality includes:
 * - Rate limiting per client IP with configurable limits
 * - CORS headers for OPTIONS preflight requests
 * - Security headers (CSP, X-Frame-Options, HSTS, etc.)
 * - Special handling for API routes with relaxed CORS
 *
 * @param {Object} params - Hook parameters
 * @param {import('@sveltejs/kit').RequestEvent} params.event - The request event
 * @param {Function} params.resolve - Function to resolve the request
 * @returns {Promise<Response>} The response with applied headers and rate limiting
 */
export const handle: Handle = async ({ event, resolve }) => {
	const { request } = event;
	const clientIP = getClientIP(request);

	const start = Date.now();
	const requestLogger = logger.setContext("REQUEST");

	requestLogger.info(`Incoming ${event.request.method} ${event.url.pathname}`);

	if (isRateLimited(clientIP)) {
		return new Response("Too Many Requests", {
			status: 429,
			headers: {
				"Retry-After": "1",
				"Content-Type": "text/plain"
			}
		});
	}

	if (request.method === "OPTIONS") {
		return new Response(null, {
			headers: {
				"Access-Control-Allow-Origin": "*", // TODO: Should be limited to own server and registered webhooks etc.
				"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
				"Access-Control-Max-Age": "86400"
			}
		});
	}

	const response = await resolve(event);

	// TODO: These has to be rechecked and coordinated with caddy's configuration
	response.headers.set("X-Frame-Options", "DENY");
	response.headers.set("X-Content-Type-Options", "nosniff");
	response.headers.set("X-XSS-Protection", "1; mode=block");
	response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

	if (event.url.protocol === "https:") {
		response.headers.set(
			"Strict-Transport-Security",
			"max-age=31536000; includeSubDomains; preload"
		);
	}

	const cspDirectives = [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline' https://unpkg.com", // Allow inline scripts and unpkg CDN (for Swagger)
		"style-src 'self' 'unsafe-inline' https://unpkg.com",
		"img-src 'self' data: https:",
		"font-src 'self' data: https://unpkg.com",
		"connect-src 'self'",
		"media-src 'self'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		"upgrade-insecure-requests"
	];
	response.headers.set("Content-Security-Policy", cspDirectives.join("; "));

	if (event.url.pathname.startsWith("/api/")) {
		response.headers.set("Access-Control-Allow-Origin", "*"); // TODO: Should be limited to own server and registered webhooks etc.
		response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
		response.headers.set(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization, X-Requested-With"
		);
	}

	const responseTime = Date.now() - start;

	requestLogger.logRequest(event.request, responseTime, response.status);
	

	return response;
};

type Error = {
	message?: string;
	stack?: string;
};

export async function handleError({ error, event, status, message }) {
	const errorLogger = logger.setContext("ERROR_HANDLER");

	errorLogger.error("Unhandled error occurred", {
		error: (error as Error).message,
		stack: (error as Error).stack,
		status,
		message,
		url: event.url.pathname,
		method: event.request.method,
		userAgent: event.request.headers.get("user-agent"),
		ip: event.getClientAddress()
	});

	return {
		message: "Internal server error occurred"
	};
}
