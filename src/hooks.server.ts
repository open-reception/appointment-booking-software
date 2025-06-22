import { type Handle } from '@sveltejs/kit';

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW = 1000; // ms
const RATE_LIMIT_MAX_REQUESTS = 10;

function getClientIP(request: Request): string {
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) {
		return forwarded.split(',')[0].trim();
	}
	
	const realIP = request.headers.get('x-real-ip');
	if (realIP) {
		return realIP;
	}
	
	return 'unknown';
}

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
 * Hook to add CORS and security headers and to perform rate limiting
 * @param event Event containing a request
 */
export const handle: Handle = async ({ event, resolve }) => {
	const { request } = event;
	const clientIP = getClientIP(request);
	
	if (isRateLimited(clientIP)) {
		return new Response('Too Many Requests', {
			status: 429,
			headers: {
				'Retry-After': '1',
				'Content-Type': 'text/plain'
			}
		});
	}
	
	if (request.method === 'OPTIONS') {
		return new Response(null, {
			headers: {
				'Access-Control-Allow-Origin': '*', // TODO: Should be limited to own server and registered webhooks etc.
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
				'Access-Control-Max-Age': '86400'
			}
		});
	}
	
	const response = await resolve(event);
	
	// TODO: These has to be rechecked and coordinated with caddy's configuration
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-XSS-Protection', '1; mode=block');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	
	if (event.url.protocol === 'https:') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
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
	response.headers.set('Content-Security-Policy', cspDirectives.join('; '));
	
	if (event.url.pathname.startsWith('/api/')) {
		response.headers.set('Access-Control-Allow-Origin', '*'); // TODO: Should be limited to own server and registered webhooks etc.
		response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
		response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
	}
	
	return response;
};