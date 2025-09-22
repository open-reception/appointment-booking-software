import { type Handle } from "@sveltejs/kit";

/**
 * SvelteKit server hook that handles CORS for OPTIONS preflight requests
 *
 * @param {Object} params - Hook parameters
 * @param {import('@sveltejs/kit').RequestEvent} params.event - The request event
 * @param {Function} params.resolve - Function to resolve the request
 * @returns {Promise<Response>} The response with applied headers and rate limiting
 */
export const corsHandle: Handle = async ({ event, resolve }) => {
  const { request } = event;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*", // TODO: Should be limited to own server and registered webhooks etc.
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const response = await resolve(event);
  return response;
};
