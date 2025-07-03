import { logger } from "$lib/logger";
import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { paraglideMiddleware } from "./i18n/server";
import { corsHandle } from "./server-hooks/corsHandle";
import { loggingHandle } from "./server-hooks/loggingHandle";
import { rateLimitHandle } from "./server-hooks/rateLimitHandle";
import { secHeaderHandle } from "./server-hooks/secHeaderHandle";

const i18nHandler: Handle = ({ event, resolve }) => {
	return paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;
		return resolve(event, {
			transformPageChunk: ({ html }) => {
				return html.replace("%lang%", locale);
			}
		});
	});
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

export const handle = sequence(
	loggingHandle,
	i18nHandler,
	rateLimitHandle,
	corsHandle,
	secHeaderHandle
);
