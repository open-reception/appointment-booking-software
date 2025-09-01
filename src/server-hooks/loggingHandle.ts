import { type Handle } from "@sveltejs/kit";
import { logger } from "$lib/logger";

/**
 * SvelteKit server hook to log requests
 *
 * @param {Object} params - Hook parameters
 * @param {import('@sveltejs/kit').RequestEvent} params.event - The request event
 * @param {Function} params.resolve - Function to resolve the request
 * @returns {Promise<Response>} The response with applied headers and rate limiting
 */
export const loggingHandle: Handle = async ({ event, resolve }) => {
  if (!event.url.pathname.startsWith("/api")) {
    return resolve(event);
  }

  const start = Date.now();
  const requestLogger = logger.setContext("REQUEST");

  const response = await resolve(event, {
    preload: () => {
      requestLogger.info(`Incoming ${event.request.method} ${event.url.pathname}`);
      return true;
    },
  });
  const responseTime = Date.now() - start;
  requestLogger.logRequest(event.request, responseTime, response.status);
  return response;
};
