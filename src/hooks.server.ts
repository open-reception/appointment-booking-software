import { paraglideMiddleware } from "./i18n/server";
import { logger } from "$lib/logger";
import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";

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

const handleRequest: Handle = async ({ event, resolve }) => {
	const start = Date.now();
	const requestLogger = logger.setContext("REQUEST");

	requestLogger.info(`Incoming ${event.request.method} ${event.url.pathname}`);

	const response = await resolve(event);
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

export const handle: Handle = sequence(handleRequest, i18nHandler);
